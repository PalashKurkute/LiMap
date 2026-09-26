# pyright: reportMissingImports=false
"""ROS 2 Launch file for FoveaGrid 2.5D Nav2 Costmap Publisher."""

from launch import LaunchDescription  # type: ignore[import-not-found, import-untyped]
from launch_ros.actions import Node  # type: ignore[import-not-found, import-untyped]


def generate_launch_description():
    return LaunchDescription([
        Node(
            package="foveagrid_nav2",
            executable="costmap_node",
            name="foveagrid_costmap_node",
            output="screen",
            parameters=[{
                "resolution": 0.10,
                "width_m": 60.0,
                "height_m": 60.0,
                "frame_id": "map",
                "topic_name": "/foveagrid/costmap",
            }],
        ),
    ])
