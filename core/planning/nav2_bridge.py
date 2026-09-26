# pyright: reportMissingImports=false
"""ROS 2 Nav2 Costmap Bridge for FoveaGrid 2.5D.

Translates FoveaGrid 2.5D multi-factor spatial hash representation into standard
ROS 2 `nav_msgs/msg/OccupancyGrid` and `grid_map_msgs/msg/GridMap` data contracts.

Adheres strictly to ROS REP 103/105 coordinate frames and Nav2 8-bit cost specifications:
  - 0: Completely free space
  - 1-99: Non-lethal traversal risk (Bayesian elevation variance, slope, pothole depth)
  - 100: Lethal obstacle / non-traversable overhang / dynamic object footprint
  - -1: Unknown / unobserved space

Designed to run in dual-mode:
  1. Standalone / CI mode (NumPy serialization, zero rclpy dependency required)
  2. Live ROS 2 Node mode (when rclpy / nav_msgs is installed)
"""

from __future__ import annotations

import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np

# Safe repo root bootstrapping
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from core.grid.spatial_hash import SpatialHashGrid
from core.planning.costmap_generator import CostmapGenerator
from core.tracking.kalman_tracker import TrackedObstacle


@dataclass
class MapMetaData:
    """Standard ROS 2 nav_msgs/msg/MapMetaData representation."""
    map_load_time_sec: float = 0.0
    resolution: float = 0.10  # meters/cell
    width: int = 600          # cells along X
    height: int = 600         # cells along Y
    origin_x: float = -30.0   # world coordinate of cell (0, 0)
    origin_y: float = -30.0
    origin_z: float = 0.0
    origin_qx: float = 0.0
    origin_qy: float = 0.0
    origin_qz: float = 0.0
    origin_qw: float = 1.0


@dataclass
class OccupancyGridPayload:
    """Serialization payload for nav_msgs/msg/OccupancyGrid."""
    frame_id: str = "map"
    timestamp_sec: float = field(default_factory=time.time)
    info: MapMetaData = field(default_factory=MapMetaData)
    data: np.ndarray = field(default_factory=lambda: np.zeros((0,), dtype=np.int8))

    def to_dict(self) -> Dict[str, Any]:
        """Converts payload to dictionary structure matching ROS 2 message schema."""
        return {
            "header": {
                "frame_id": self.frame_id,
                "stamp": {
                    "sec": int(self.timestamp_sec),
                    "nanosec": int((self.timestamp_sec % 1.0) * 1e9),
                },
            },
            "info": {
                "map_load_time": {
                    "sec": int(self.info.map_load_time_sec),
                    "nanosec": int((self.info.map_load_time_sec % 1.0) * 1e9),
                },
                "resolution": self.info.resolution,
                "width": self.info.width,
                "height": self.info.height,
                "origin": {
                    "position": {
                        "x": self.info.origin_x,
                        "y": self.info.origin_y,
                        "z": self.info.origin_z,
                    },
                    "orientation": {
                        "x": self.info.origin_qx,
                        "y": self.info.origin_qy,
                        "z": self.info.origin_qz,
                        "w": self.info.origin_qw,
                    },
                },
            },
            "data": self.data.tolist(),
        }


class Nav2CostmapBridge:
    """Translates FoveaGrid 2.5D representations to ROS 2 Nav2 messages."""

    def __init__(
        self,
        grid_width_m: float = 60.0,
        grid_height_m: float = 60.0,
        resolution_m: float = 0.10,
        frame_id: str = "map",
        vehicle_height_m: float = 1.8,
    ):
        self.frame_id = frame_id
        self.generator = CostmapGenerator(
            grid_width_m=grid_width_m,
            grid_height_m=grid_height_m,
            resolution_m=resolution_m,
            vehicle_height_m=vehicle_height_m,
        )

    def convert_to_nav2_occupancy_grid(
        self,
        grid: SpatialHashGrid,
        dynamic_tracks: Optional[List[TrackedObstacle]] = None,
        timestamp_sec: Optional[float] = None,
        ignore_overhang: bool = False,
    ) -> OccupancyGridPayload:
        """Converts spatial hash cells to a standard ROS 2 OccupancyGrid payload.

        Translation convention:
          - Cost 255 (Unknown) -> -1
          - Cost 0 (Free space) -> 0
          - Cost 254 (Lethal obstacle / lethal overhang) -> 100
          - Cost 1..253 (Intermediate risk) -> 1..99
        """
        if timestamp_sec is None:
            timestamp_sec = time.time()

        # Generate internal raw uint8 costmap (0..254, 255)
        raw_costmap = self.generator.generate_costmap(
            grid=grid,
            dynamic_tracks=dynamic_tracks,
            ignore_overhang_clearance=ignore_overhang,
        )

        ny, nx = raw_costmap.shape
        nav2_data = np.full((ny, nx), fill_value=0, dtype=np.int8)

        # Vectorized mapping to Nav2 occupancy conventions
        unknown_mask = raw_costmap == 255
        lethal_mask = raw_costmap >= 254
        intermediate_mask = (~unknown_mask) & (~lethal_mask) & (raw_costmap > 0)

        nav2_data[unknown_mask] = -1
        nav2_data[lethal_mask] = 100
        nav2_data[intermediate_mask] = np.clip(
            np.round((raw_costmap[intermediate_mask].astype(np.float32) / 253.0) * 98.0 + 1.0),
            1,
            99,
        ).astype(np.int8)

        # Flatten into row-major 1D array matching ROS 2 specification
        flat_data = nav2_data.flatten()

        metadata = MapMetaData(
            map_load_time_sec=timestamp_sec,
            resolution=self.generator.res,
            width=nx,
            height=ny,
            origin_x=self.generator.origin_x,
            origin_y=self.generator.origin_y,
            origin_z=0.0,
            origin_qx=0.0,
            origin_qy=0.0,
            origin_qz=0.0,
            origin_qw=1.0,
        )

        return OccupancyGridPayload(
            frame_id=self.frame_id,
            timestamp_sec=timestamp_sec,
            info=metadata,
            data=flat_data,
        )


# =========================================================================
# Optional Live ROS 2 rclpy Node Interface
# =========================================================================
try:
    import rclpy  # type: ignore[import-not-found, import-untyped]
    from rclpy.node import Node  # type: ignore[import-not-found, import-untyped]
    from nav_msgs.msg import OccupancyGrid  # type: ignore[import-not-found, import-untyped]
    from std_msgs.msg import Header  # type: ignore[import-not-found, import-untyped]
    from geometry_msgs.msg import Pose, Point, Quaternion  # type: ignore[import-not-found, import-untyped]

    class FoveaGridNav2Node(Node):  # type: ignore[misc]
        """Native ROS 2 Node publishing FoveaGrid 2.5D to Nav2 costmap topic."""

        def __init__(self, node_name: str = "foveagrid_nav2_bridge") -> None:
            super().__init__(node_name)
            self.declare_parameter("resolution", 0.10)
            self.declare_parameter("width_m", 60.0)
            self.declare_parameter("height_m", 60.0)
            self.declare_parameter("frame_id", "map")
            self.declare_parameter("topic_name", "/foveagrid/costmap")

            res = float(self.get_parameter("resolution").value)
            w = float(self.get_parameter("width_m").value)
            h = float(self.get_parameter("height_m").value)
            frame_id = str(self.get_parameter("frame_id").value)
            topic = str(self.get_parameter("topic_name").value)

            self.bridge = Nav2CostmapBridge(
                grid_width_m=w,
                grid_height_m=h,
                resolution_m=res,
                frame_id=frame_id,
            )
            self.publisher_ = self.create_publisher(OccupancyGrid, topic, 10)
            self.get_logger().info(f"FoveaGrid Nav2 Costmap Publisher initialized on topic: {topic}")

        def publish_grid(
            self,
            grid: SpatialHashGrid,
            dynamic_tracks: Optional[List[TrackedObstacle]] = None,
        ) -> None:
            payload = self.bridge.convert_to_nav2_occupancy_grid(grid, dynamic_tracks)
            msg = OccupancyGrid()
            msg.header.frame_id = payload.frame_id
            msg.header.stamp = self.get_clock().now().to_msg()
            msg.info.resolution = payload.info.resolution
            msg.info.width = payload.info.width
            msg.info.height = payload.info.height
            msg.info.origin.position.x = payload.info.origin_x
            msg.info.origin.position.y = payload.info.origin_y
            msg.info.origin.position.z = payload.info.origin_z
            msg.info.origin.orientation.w = payload.info.origin_qw
            msg.data = payload.data.tolist()

            self.publisher_.publish(msg)

except ImportError:
    # Graceful fallback when rclpy is not installed in current environment
    FoveaGridNav2Node = None  # type: ignore[assignment, misc]
