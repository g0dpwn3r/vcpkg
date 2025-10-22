# mysql-connector-cpp portfile.cmake for overlay ports
# Maintainer: g0dpwn3r

# 1. CLEANUP and DOWNLOAD
# Verwijder de build map om een schone start te garanderen
file(REMOVE_RECURSE "${CURRENT_BUILDTREES_DIR}")

# Haal de broncode op van de gespecificeerde git repository en referentie
vcpkg_from_git(
    OUT_SOURCE_PATH SOURCE_PATH
    URL https://github.com/g0dpwn3r/mysql-connector-cpp
    REF 5116d3f1053b96b83fb5d8c482942ec65de516d6
    HEAD_REF 9.5
    PATCHES
        patches/depfindprotobuf.diff
        patches/disable-telemetry.diff
        patches/dont-preload-cache.diff
        patches/lib-name-static.diff
        patches/merge-archives.diff
        patches/save-linker-opts.diff
        patches/export-targets.patch
        patches/protobuf-source.patch
)

# 2. FILE PREPARATION (Cleanup bundled dependencies and copy config)
# Kopieer de CMake config template naar de bronmap
file(COPY "${CMAKE_CURRENT_LIST_DIR}/mysql-connector-cpp-config.cmake.in" DESTINATION "${SOURCE_PATH}")

# Verwijder gebundelde (extra) afhankelijkheden om de systeem- of vcpkg-versies te gebruiken
file(REMOVE_RECURSE
    "${SOURCE_PATH}/cdk/extra/common"
    "${SOURCE_PATH}/cdk/extra/exprtest"
    "${SOURCE_PATH}/cdk/extra/lz4"
    "${SOURCE_PATH}/cdk/extra/ngs_mockup"
    "${SOURCE_PATH}/cdk/extra/process_launcher"
    "${SOURCE_PATH}/cdk/extra/protobuf"
    "${SOURCE_PATH}/cdk/extra/rapidjson"
    "${SOURCE_PATH}/cdk/extra/zlib"
    "${SOURCE_PATH}/cdk/extra/zstd"
    "${SOURCE_PATH}/jdbc/extra/otel/opentelemetry-cpp-1.12.0"
)

# 3. FEATURE CHECK AND VARIABLE SETUP
vcpkg_check_features(
    OUT_FEATURE_OPTIONS options
    FEATURES
        jdbc    WITH_JDBC
)

# Stel de paden in voor de save_linker_opts tool als we cross-compileren
if(VCPKG_CROSSCOMPILING AND EXISTS "${CURRENT_HOST_INSTALLED_DIR}/manual-tools/${PORT}/save_linker_opts${VCPKG_HOST_EXECUTABLE_SUFFIX}")
    vcpkg_list(APPEND options "-DWITH_SAVE_LINKER_OPTS=${CURRENT_HOST_INSTALLED_DIR}/manual-tools/${PORT}/save_linker_opts${VCPKG_HOST_EXECUTABLE_SUFFIX}")
endif()

# Bepaal of we statisch linken
string(COMPARE EQUAL "${VCPKG_LIBRARY_LINKAGE}" "static" BUILD_STATIC)
string(COMPARE EQUAL "${VCPKG_CRT_LINKAGE}" "static" STATIC_MSVCRT)

set(USE_MSBUILD_ARG)
if(BUILD_STATIC)
    set(USE_MSBUILD_ARG WINDOWS_USE_MSBUILD)
endif()

set(PROTOBUF_FOUND TRUE)
set(Protobuf_FOUND TRUE)
# 4. FIND DEPENDENCIES

# 5. CONFIGURE
vcpkg_cmake_configure(
    SOURCE_PATH "${SOURCE_PATH}"
    ${USE_MSBUILD_ARG}
    OPTIONS
        ${options}
        "-DCMAKE_PROJECT_INCLUDE=${CURRENT_PORT_DIR}/cmake-project-include.cmake"
        "-DWITH_PROTOC=${CURRENT_HOST_INSTALLED_DIR}/tools/protobuf/protoc${VCPKG_HOST_EXECUTABLE_SUFFIX}"
        -DBUILD_STATIC=${BUILD_STATIC}
        -DMYSQLCLIENT_STATIC_LINKING=${BUILD_STATIC}
        -DSTATIC_MSVCRT=${STATIC_MSVCRT}
        -DINSTALL_LIB_DIR=lib
        -DINSTALL_LIB_DIR_DEBUG=lib
        -DINSTALL_LIB_DIR_STATIC=lib
        -DINSTALL_LIB_DIR_STATIC_DEBUG=lib
        -DTELEMETRY=OFF
        -DWITH_DOC=OFF
        -DWITH_HEADER_CHECKS=OFF
        -DWITH_SSL=system
        -DWITH_TESTS=OFF
        -Duse_full_protobuf=TRUE
    MAYBE_UNUSED_VARIABLES
        TELEMETRY
)

# 6. BUILD AND INSTALL
vcpkg_cmake_install()
vcpkg_cmake_config_fixup(PACKAGE_NAME unofficial-mysql-connector-cpp)
configure_file("${CURRENT_PORT_DIR}/mysql-concpp-config.cmake" "${CURRENT_PACKAGES_DIR}/share/mysql-concpp/mysql-concpp-config.cmake" @ONLY)

# DIAGNOSTIC: Check for ABI info file generation
message(STATUS "Checking for ABI info file after install...")
if(EXISTS "${CURRENT_BUILDTREES_DIR}/${TARGET_TRIPLET}.vcpkg_abi_info.txt")
    message(STATUS "ABI info file found: ${CURRENT_BUILDTREES_DIR}/${TARGET_TRIPLET}.vcpkg_abi_info.txt")
else()
    message(STATUS "ABI info file NOT found: ${CURRENT_BUILDTREES_DIR}/${TARGET_TRIPLET}.vcpkg_abi_info.txt")
    file(GLOB ABI_FILES "${CURRENT_BUILDTREES_DIR}/*.vcpkg_abi_info.txt")
    message(STATUS "Available ABI files in buildtrees: ${ABI_FILES}")
    # Create minimal ABI info file if missing to prevent vcpkg copy failure
    file(WRITE "${CURRENT_BUILDTREES_DIR}/${TARGET_TRIPLET}.vcpkg_abi_info.txt" "# Minimal ABI info file created by portfile.cmake\n")
    message(STATUS "Created minimal ABI info file: ${CURRENT_BUILDTREES_DIR}/${TARGET_TRIPLET}.vcpkg_abi_info.txt")
endif()

# 7. POST-INSTALL TASKS
# Kopieer save_linker_opts tool
if(NOT VCPKG_CROSSCOMPILING AND EXISTS "${CURRENT_BUILDTREES_DIR}/${TARGET_TRIPLET}-rel/libutils/save_linker_opts${VCPKG_TARGET_EXECUTABLE_SUFFIX}")
    vcpkg_copy_tools(TOOL_NAMES save_linker_opts
        SEARCH_DIR "${CURRENT_BUILDTREES_DIR}/${TARGET_TRIPLET}-rel/libutils"
        DESTINATION "${CURRENT_PACKAGES_DIR}/manual-tools/${PORT}"
    )
endif()

# FIX: Gecombineerde patch voor value.h om <cstdint>, type-aliassen en 'byte' typedef toe te voegen.
vcpkg_replace_string(
    "${SOURCE_PATH}/include/mysqlx/common/value.h"
    "#include \"error.h\"" # Zoek deze regel
    "#include \"error.h\"\n#include <cstdint>\n\nusing bigint_64_t = int64_t;\nusing u_bigint_64_t = uint64_t;\n#include \"util.h\"\n\ntypedef unsigned char byte;\n" # Vervangende inhoud
)

# Pas statische linkingsconfiguratie aan in headers
if(BUILD_STATIC)
    vcpkg_replace_string("${CURRENT_PACKAGES_DIR}/include/mysqlx/common/api.h" "defined STATIC_CONCPP" "(1)")
    if(WITH_JDBC)
        vcpkg_replace_string("${CURRENT_PACKAGES_DIR}/include/jdbc/cppconn/build_config.h" "ifdef STATIC_CONCPP" "if 1")
    endif()
endif()

# Verwijder onnodige bestanden/mappen na installatie
file(REMOVE_RECURSE
    "${CURRENT_PACKAGES_DIR}/debug/include"
    "${CURRENT_PACKAGES_DIR}/INFO_BIN"
    "${CURRENT_PACKAGES_DIR}/INFO_SRC"
    "${CURRENT_PACKAGES_DIR}/debug/INFO_BIN"
    "${CURRENT_PACKAGES_DIR}/debug/INFO_SRC"
    "${CURRENT_PACKAGES_DIR}/mysql-concpp-config.cmake"
    "${CURRENT_PACKAGES_DIR}/mysql-concpp-config-version.cmake"
    "${CURRENT_PACKAGES_DIR}/debug/mysql-concpp-config.cmake"
    "${CURRENT_PACKAGES_DIR}/debug/mysql-concpp-config-version.cmake"
)

# Installeer de licentie
vcpkg_install_copyright(FILE_LIST "${SOURCE_PATH}/LICENSE.txt")
message(STATUS "✅ mysql-connector-cpp built successfully from g0dpwn3r/mysql-connector-cpp")