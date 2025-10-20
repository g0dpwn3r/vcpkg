vcpkg_from_git(
    OUT_SOURCE_PATH SOURCE_PATH
    URL https://github.com/g0dpwn3r/mysql-connector-cpp.git
    REF main
    WORKING_DIRECTORY ${CURRENT_BUILDTREES_DIR}/src
    PATCHES
        depfindprotobuf.diff
        disable-telemetry.diff
        dont-preload-cache.diff
        lib-name-static.diff
        merge-archives.diff
        save-linker-opts.diff
        export-targets.patch
        protobuf-source.patch  
        add-cstdint.patch
)

vcpkg_cmake_configure(
    SOURCE_PATH ${SOURCE_PATH}
    PREFER_NINJA
    OPTIONS
        -DWITH_SSL=system
        -DWITH_PROTOBUF=system
        -DWITH_BOOST=system
        -DBUILD_STATIC=OFF
        -DWITH_JDBC=ON
)

vcpkg_cmake_build(
    CONFIG Release
)

vcpkg_cmake_install()
vcpkg_cmake_config_fixup()
vcpkg_copy_pdbs()
