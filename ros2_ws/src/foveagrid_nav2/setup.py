import os
from glob import glob
from setuptools import find_packages, setup

package_name = "foveagrid_nav2"

setup(
    name=package_name,
    version="1.0.0",
    packages=find_packages(exclude=["test"]),
    data_files=[
        ("share/ament_index/resource_index/packages", ["resource/" + package_name] if os.path.exists("resource/" + package_name) else []),
        ("share/" + package_name, ["package.xml"]),
        (os.path.join("share", package_name, "launch"), glob("launch/*.launch.py")),
    ],
    install_requires=["setuptools"],
    zip_safe=True,
    maintainer="Ved Jadhav",
    maintainer_email="ved.amit.jadhav@gmail.com",
    description="ROS 2 Nav2 Costmap Layer and Bridge for FoveaGrid 2.5D Adaptive LiDAR Mapping",
    license="Apache-2.0",
    tests_require=["pytest"],
    entry_points={
        "console_scripts": [
            "costmap_node = foveagrid_nav2.costmap_node:main",
        ],
    },
)
