# pyright: reportMissingImports=false
"""ROS 2 Nav2 Costmap Publisher Node for FoveaGrid 2.5D."""

import sys
from pathlib import Path

# Repo path resolution
repo_root = Path(__file__).resolve().parent.parent.parent.parent
sys.path.insert(0, str(repo_root))

from core.planning.nav2_bridge import FoveaGridNav2Node, Nav2CostmapBridge


def main(args=None):
    try:
        import rclpy  # type: ignore[import-not-found, import-untyped]
    except ImportError:
        print("[foveagrid_nav2] Error: rclpy is not installed in the current Python environment.")
        print("[foveagrid_nav2] To run standalone serialization without ROS 2, use core.planning.nav2_bridge.Nav2CostmapBridge.")
        sys.exit(1)

    rclpy.init(args=args)
    if FoveaGridNav2Node is None:
        print("[foveagrid_nav2] Failed to initialize ROS 2 Node classes.")
        sys.exit(1)

    node = FoveaGridNav2Node()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
