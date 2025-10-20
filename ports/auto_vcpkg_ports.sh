#!/bin/bash
# auto_vcpkg_ports.sh
# Usage: ./auto_vcpkg_ports.sh
# Automatically generates vcpkg ports for multiple git repos

# Directory of your vcpkg repo
VCPKG_DIR=~/code/vcpkg
PORTS_DIR="$VCPKG_DIR/ports"

# List of your forks (name and git URL)
# Format: "port_name git_url [dependencies]"
REPOS=(
  "abseil https://github.com/g0dpwn3r/abseil"
  "utf8-range https://github.com/g0dpwn3r/utf8-range"
  "vcpkg-cmake https://github.com/g0dpwn3r/vcpkg-cmake"
  "vcpkg-cmake-config https://github.com/g0dpwn3r/vcpkg-cmake-config"
  "boost-filesystem https://github.com/g0dpwn3r/boost-filesystem boost,boost-system"
  "boost-system https://github.com/g0dpwn3r/boost-system"
  "boost-regex https://github.com/g0dpwn3r/boost-regex boost"
  "boost-asio https://github.com/g0dpwn3r/boost-asio boost"
  "boost-beast https://github.com/g0dpwn3r/boost-beast boost,boost-asio"
  "boost-program-options https://github.com/g0dpwn3r/boost-program-options boost"
  "catch2 https://github.com/g0dpwn3r/catch2"
  "mysql-connector-cpp https://github.com/g0dpwn3r/mysql-connector-cpp boost,openssl,protobuf,zlib"
  "nlohmann-json https://github.com/g0dpwn3r/nlohmann-json"
  "curl https://github.com/g0dpwn3r/curl"
  "google-cloud-cpp https://github.com/g0dpwn3r/google-cloud-cpp protobuf,abseil"
  "grpc https://github.com/g0dpwn3r/grpc protobuf,abseil"
  "gtest https://github.com/g0dpwn3r/gtest"
  "openssl https://github.com/g0dpwn3r/openssl"
  "protobuf https://github.com/g0dpwn3r/protobuf"
  "zlib https://github.com/g0dpwn3r/zlib"
  "zstd https://github.com/g0dpwn3r/zstd"
)

mkdir -p "$PORTS_DIR"

for entry in "${REPOS[@]}"; do
    # Split entry
    IFS=' ' read -r PORT_NAME GIT_URL DEP_LIST <<< "$entry"
    
    PORT_DIR="$PORTS_DIR/$PORT_NAME"
    mkdir -p "$PORT_DIR"

    # Convert comma-separated dependencies to JSON array
    if [ -n "$DEP_LIST" ]; then
        JSON_DEPS="[\"$(echo $DEP_LIST | sed 's/,/","/g')\"]"
    else
        JSON_DEPS="[]"
    fi

    # Create vcpkg.json
    cat > "$PORT_DIR/vcpkg.json" <<EOF
{
  "name": "$PORT_NAME",
  "version-string": "1.0.0-g0dpwn3r",
  "description": "Custom fork of $PORT_NAME patched by g0dpwn3r.",
  "homepage": "$GIT_URL",
  "license": "MIT",
  "dependencies": $JSON_DEPS
}
EOF

    # Create portfile.cmake
    cat > "$PORT_DIR/portfile.cmake" <<'EOF'
vcpkg_from_git(
    OUT_SOURCE_PATH SOURCE_PATH
    URL ${GIT_URL}
    REF main
    WORKING_DIRECTORY ${CURRENT_BUILDTREES_DIR}/src
)

vcpkg_cmake_configure(
    SOURCE_PATH ${SOURCE_PATH}
    PREFER_NINJA
)

vcpkg_cmake_build(CONFIG Release)
vcpkg_cmake_install()
vcpkg_cmake_config_fixup()
vcpkg_copy_pdbs()
EOF

    # Replace ${GIT_URL} placeholder in portfile
    sed -i "s|\${GIT_URL}|$GIT_URL|g" "$PORT_DIR/portfile.cmake"

    echo "Created vcpkg port for $PORT_NAME"
done

echo "All ports generated in $PORTS_DIR"
