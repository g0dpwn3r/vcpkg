vcpkg_from_git(
    OUT_SOURCE_PATH SOURCE_PATH
    URL https://github.com/g0dpwn3r/googleapis.git
    REF main  # Or a commit hash for pinning
    WORKING_DIRECTORY ${CURRENT_BUILDTREES_DIR}/src
)

# Configure with CMake
vcpkg_cmake_configure(
    SOURCE_PATH ${SOURCE_PATH}
    PREFER_NINJA
    OPTIONS
        -Dprotobuf_BUILD_TESTS=OFF
        -Dprotobuf_BUILD_SHARED_LIBS=ON
        -DgRPC_INSTALL=OFF
)

# Build the project
vcpkg_cmake_build(
    CONFIG Release
)

# Install into vcpkg directories
vcpkg_cmake_install()

# Fixup paths and copy pdbs if needed
vcpkg_cmake_config_fixup()
vcpkg_copy_pdbs()
