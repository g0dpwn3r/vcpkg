"use strict";
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = void 0;
const assert_1 = require("assert");
const crypto_1 = require("crypto");
const metadata_file_1 = require("./amf/metadata-file");
const artifact_1 = require("./artifacts/artifact");
const constants_1 = require("./constants");
const http_filesystem_1 = require("./fs/http-filesystem");
const local_filesystem_1 = require("./fs/local-filesystem");
const unified_filesystem_1 = require("./fs/unified-filesystem");
const vsix_local_filesystem_1 = require("./fs/vsix-local-filesystem");
const i18n_1 = require("./i18n");
const git_1 = require("./installers/git");
const nuget_1 = require("./installers/nuget");
const untar_1 = require("./installers/untar");
const unzip_1 = require("./installers/unzip");
const registries_1 = require("./registries/registries");
const channels_1 = require("./util/channels");
function hexsha(content) {
    return (0, crypto_1.createHash)('sha256').update(content, 'ascii').digest('hex');
}
function formatArtifactEntry(entry) {
    // we hash all the things to remove PII
    return `${hexsha(entry.registryUri)}:${hexsha(entry.id)}:${hexsha(entry.version)}`;
}
/**
 * The Session class is used to hold a reference to the
 * message channels,
 * the filesystems,
 * and any other 'global' data that should be kept.
 *
 */
class Session {
    context;
    settings;
    /** @internal */
    stopwatch = new channels_1.Stopwatch();
    fileSystem;
    channels;
    homeFolder;
    nextPreviousEnvironment;
    installFolder;
    registryFolder;
    telemetryFile;
    get vcpkgCommand() { return this.settings.vcpkgCommand; }
    globalConfig;
    downloads;
    currentDirectory;
    configuration;
    /** register installer functions here */
    installers = new Map([
        ['nuget', nuget_1.installNuGet],
        ['unzip', unzip_1.installUnZip],
        ['untar', untar_1.installUnTar],
        ['git', git_1.installGit]
    ]);
    registryDatabase = new registries_1.RegistryDatabase();
    globalRegistryResolver = new registries_1.RegistryResolver(this.registryDatabase);
    processVcpkgArg(argSetting, defaultName) {
        return argSetting ? this.fileSystem.file(argSetting) : this.homeFolder.join(defaultName);
    }
    constructor(currentDirectory, context, settings) {
        this.context = context;
        this.settings = settings;
        this.fileSystem = new unified_filesystem_1.UnifiedFileSystem(this).
            register('file', new local_filesystem_1.LocalFileSystem(this)).
            register('vsix', new vsix_local_filesystem_1.VsixLocalFilesystem(this)).
            register('https', new http_filesystem_1.HttpsFileSystem(this));
        this.channels = new channels_1.Channels(this);
        if (settings.telemetryFile) {
            this.telemetryFile = this.fileSystem.file(settings.telemetryFile);
        }
        this.homeFolder = this.fileSystem.file(settings.homeFolder);
        this.downloads = this.processVcpkgArg(settings.vcpkgDownloads, 'downloads');
        this.globalConfig = this.processVcpkgArg(settings.globalConfig, constants_1.configurationName);
        this.registryFolder = this.processVcpkgArg(settings.vcpkgRegistriesCache, 'registries').join('artifact');
        this.installFolder = this.processVcpkgArg(settings.vcpkgArtifactsRoot, 'artifacts');
        this.nextPreviousEnvironment = this.processVcpkgArg(settings.nextPreviousEnvironment, `previous-environment-${Date.now().toFixed()}.json`);
        this.currentDirectory = this.fileSystem.file(currentDirectory);
    }
    parseLocation(location) {
        // Drive letter, absolute Unix path, or drive-relative windows path, treat as a file
        if (/^[A-Za-z]:/.exec(location) || location.startsWith('/') || location.startsWith('\\')) {
            return this.fileSystem.file(location);
        }
        // Otherwise, it's a URI
        return this.fileSystem.parseUri(location);
    }
    async saveConfig() {
        await this.configuration?.save(this.globalConfig);
    }
    async init() {
        // load global configuration
        if (!await this.fileSystem.isDirectory(this.homeFolder)) {
            // let's create the folder
            try {
                await this.fileSystem.createDirectory(this.homeFolder);
            }
            catch (error) {
                // if this throws, let it
                this.channels.debug(error?.message);
            }
            // check if it got made, because at an absolute minimum, we need a folder, so failing this is catastrophic.
            assert_1.strict.ok(await this.fileSystem.isDirectory(this.homeFolder), (0, i18n_1.i) `Fatal: The root folder '${this.homeFolder.fsPath}' cannot be created`);
        }
        if (!await this.fileSystem.isFile(this.globalConfig)) {
            try {
                await this.globalConfig.writeUTF8(constants_1.defaultConfig);
            }
            catch {
                // if this throws, let it
            }
            // check if it got made, because at an absolute minimum, we need the config file, so failing this is catastrophic.
            assert_1.strict.ok(await this.fileSystem.isFile(this.globalConfig), (0, i18n_1.i) `Fatal: The global configuration file '${this.globalConfig.fsPath}' cannot be created`);
        }
        // got past the checks, let's load the configuration.
        this.configuration = await metadata_file_1.MetadataFile.parseMetadata(this.globalConfig.fsPath, this.globalConfig, this);
        this.channels.debug(`Loaded global configuration file '${this.globalConfig.fsPath}'`);
        // load the registries
        for (const [name, regDef] of this.configuration.registries) {
            const loc = regDef.location.get(0);
            if (loc) {
                const uri = this.parseLocation(loc);
                const reg = await this.registryDatabase.loadRegistry(this, uri);
                this.globalRegistryResolver.add(uri, name);
                if (reg) {
                    this.channels.debug(`Loaded global manifest ${name} => ${uri.formatted}`);
                }
            }
        }
        return this;
    }
    async findProjectProfile(startLocation = this.currentDirectory) {
        let location = startLocation;
        const path = location.join(constants_1.configurationName);
        if (await this.fileSystem.isFile(path)) {
            return path;
        }
        location = location.join('..');
        return (location.toString() === startLocation.toString()) ? undefined : this.findProjectProfile(location);
    }
    async getInstalledArtifacts() {
        const result = new Array();
        if (!await this.installFolder.exists()) {
            return result;
        }
        for (const [folder, stat] of await this.installFolder.readDirectory(undefined, { recursive: true })) {
            try {
                const artifactJsonPath = folder.join('artifact.json');
                const metadata = await metadata_file_1.MetadataFile.parseMetadata(artifactJsonPath.fsPath, artifactJsonPath, this);
                result.push({
                    folder,
                    id: metadata.id,
                    artifact: await new artifact_1.InstalledArtifact(this, metadata)
                });
            }
            catch {
                // not a valid install.
            }
        }
        return result;
    }
    /** returns an installer function (or undefined) for a given installerkind */
    artifactInstaller(installInfo) {
        return this.installers.get(installInfo.installerKind);
    }
    async openManifest(filename, uri) {
        return await metadata_file_1.MetadataFile.parseConfiguration(filename, await uri.readUTF8(), this);
    }
    #acquiredArtifacts = [];
    #activatedArtifacts = [];
    trackAcquire(registryUri, id, version) {
        this.#acquiredArtifacts.push({ registryUri: registryUri, id: id, version: version });
    }
    trackActivate(registryUri, id, version) {
        this.#activatedArtifacts.push({ registryUri: registryUri, id: id, version: version });
    }
    writeTelemetry() {
        const acquiredArtifacts = this.#acquiredArtifacts.map(formatArtifactEntry).join(',');
        const activatedArtifacts = this.#activatedArtifacts.map(formatArtifactEntry).join(',');
        const telemetryFile = this.telemetryFile;
        if (telemetryFile) {
            return telemetryFile.writeUTF8(JSON.stringify({
                'acquired-artifacts': acquiredArtifacts,
                'activated-artifacts': activatedArtifacts
            }));
        }
        return Promise.resolve(undefined);
    }
}
exports.Session = Session;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Vzc2lvbi5qcyIsInNvdXJjZVJvb3QiOiJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vbWljcm9zb2Z0L3ZjcGtnLXRvb2wvbWFpbi92Y3BrZy1hcnRpZmFjdHMvIiwic291cmNlcyI6WyJzZXNzaW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSx1Q0FBdUM7QUFDdkMsa0NBQWtDOzs7QUFFbEMsbUNBQWdDO0FBQ2hDLG1DQUFvQztBQUNwQyx1REFBbUQ7QUFDbkQsbURBQW1FO0FBQ25FLDJDQUErRDtBQUUvRCwwREFBdUQ7QUFDdkQsNERBQXdEO0FBQ3hELGdFQUE0RDtBQUM1RCxzRUFBaUU7QUFDakUsaUNBQTJCO0FBQzNCLDBDQUE4QztBQUM5Qyw4Q0FBa0Q7QUFDbEQsOENBQWtEO0FBQ2xELDhDQUFrRDtBQUdsRCx3REFBNkU7QUFDN0UsOENBQXNEO0FBNkN0RCxTQUFTLE1BQU0sQ0FBQyxPQUFlO0lBQzdCLE9BQU8sSUFBQSxtQkFBVSxFQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3JFLENBQUM7QUFFRCxTQUFTLG1CQUFtQixDQUFDLEtBQW9CO0lBQy9DLHVDQUF1QztJQUN2QyxPQUFPLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztBQUNyRixDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsTUFBYSxPQUFPO0lBZ0NvQztJQUFrQztJQS9CeEYsZ0JBQWdCO0lBQ1AsU0FBUyxHQUFHLElBQUksb0JBQVMsRUFBRSxDQUFDO0lBQzVCLFVBQVUsQ0FBYTtJQUN2QixRQUFRLENBQVc7SUFDbkIsVUFBVSxDQUFNO0lBQ2hCLHVCQUF1QixDQUFNO0lBQzdCLGFBQWEsQ0FB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
// SIG // Begin signature block
// SIG // MIIoRAYJKoZIhvcNAQcCoIIoNTCCKDECAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // lvgQpfCWjvkronYRzkEqlnaYeL84+8B0+BilLb4ybiug
// SIG // gg12MIIF9DCCA9ygAwIBAgITMwAABARsdAb/VysncgAA
// SIG // AAAEBDANBgkqhkiG9w0BAQsFADB+MQswCQYDVQQGEwJV
// SIG // UzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
// SIG // UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
// SIG // cmF0aW9uMSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBT
// SIG // aWduaW5nIFBDQSAyMDExMB4XDTI0MDkxMjIwMTExNFoX
// SIG // DTI1MDkxMTIwMTExNFowdDELMAkGA1UEBhMCVVMxEzAR
// SIG // BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1v
// SIG // bmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
// SIG // bjEeMBwGA1UEAxMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA
// SIG // tCg32mOdDA6rBBnZSMwxwXegqiDEUFlvQH9Sxww07hY3
// SIG // w7L52tJxLg0mCZjcszQddI6W4NJYb5E9QM319kyyE0l8
// SIG // EvA/pgcxgljDP8E6XIlgVf6W40ms286Cr0azaA1f7vaJ
// SIG // jjNhGsMqOSSSXTZDNnfKs5ENG0bkXeB2q5hrp0qLsm/T
// SIG // WO3oFjeROZVHN2tgETswHR3WKTm6QjnXgGNj+V6rSZJO
// SIG // /WkTqc8NesAo3Up/KjMwgc0e67x9llZLxRyyMWUBE9co
// SIG // T2+pUZqYAUDZ84nR1djnMY3PMDYiA84Gw5JpceeED38O
// SIG // 0cEIvKdX8uG8oQa047+evMfDRr94MG9EWwIDAQABo4IB
// SIG // czCCAW8wHwYDVR0lBBgwFgYKKwYBBAGCN0wIAQYIKwYB
// SIG // BQUHAwMwHQYDVR0OBBYEFPIboTWxEw1PmVpZS+AzTDwo
// SIG // oxFOMEUGA1UdEQQ+MDykOjA4MR4wHAYDVQQLExVNaWNy
// SIG // b3NvZnQgQ29ycG9yYXRpb24xFjAUBgNVBAUTDTIzMDAx
// SIG // Mis1MDI5MjMwHwYDVR0jBBgwFoAUSG5k5VAF04KqFzc3
// SIG // IrVtqMp1ApUwVAYDVR0fBE0wSzBJoEegRYZDaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jcmwvTWlj
// SIG // Q29kU2lnUENBMjAxMV8yMDExLTA3LTA4LmNybDBhBggr
// SIG // BgEFBQcBAQRVMFMwUQYIKwYBBQUHMAKGRWh0dHA6Ly93
// SIG // d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY2VydHMvTWlj
// SIG // Q29kU2lnUENBMjAxMV8yMDExLTA3LTA4LmNydDAMBgNV
// SIG // HRMBAf8EAjAAMA0GCSqGSIb3DQEBCwUAA4ICAQCI5g/S
// SIG // KUFb3wdUHob6Qhnu0Hk0JCkO4925gzI8EqhS+K4umnvS
// SIG // BU3acsJ+bJprUiMimA59/5x7WhJ9F9TQYy+aD9AYwMtb
// SIG // KsQ/rst+QflfML+Rq8YTAyT/JdkIy7R/1IJUkyIS6srf
// SIG // G1AKlX8n6YeAjjEb8MI07wobQp1F1wArgl2B1mpTqHND
// SIG // lNqBjfpjySCScWjUHNbIwbDGxiFr93JoEh5AhJqzL+8m
// SIG // onaXj7elfsjzIpPnl8NyH2eXjTojYC9a2c4EiX0571Ko
// SIG // mhENF3RtR25A7/X7+gk6upuE8tyMy4sBkl2MUSF08U+E
// SIG // 2LOVcR8trhYxV1lUi9CdgEU2CxODspdcFwxdT1+G8YNc
// SIG // gzHyjx3BNSI4nOZcdSnStUpGhCXbaOIXfvtOSfQX/UwJ
// SIG // oruhCugvTnub0Wna6CQiturglCOMyIy/6hu5rMFvqk9A
// SIG // ltIJ0fSR5FwljW6PHHDJNbCWrZkaEgIn24M2mG1M/Ppb
// SIG // /iF8uRhbgJi5zWxo2nAdyDBqWvpWxYIoee/3yIWpquVY
// SIG // cYGhJp/1I1sq/nD4gBVrk1SKX7Do2xAMMO+cFETTNSJq
// SIG // fTSSsntTtuBLKRB5mw5qglHKuzapDiiBuD1Zt4QwxA/1
// SIG // kKcyQ5L7uBayG78kxlVNNbyrIOFH3HYmdH0Pv1dIX/Mq
// SIG // 7avQpAfIiLpOWwcbjzCCB3owggVioAMCAQICCmEOkNIA
// SIG // AAAAAAMwDQYJKoZIhvcNAQELBQAwgYgxCzAJBgNVBAYT
// SIG // AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
// SIG // EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
// SIG // cG9yYXRpb24xMjAwBgNVBAMTKU1pY3Jvc29mdCBSb290
// SIG // IENlcnRpZmljYXRlIEF1dGhvcml0eSAyMDExMB4XDTEx
// SIG // MDcwODIwNTkwOVoXDTI2MDcwODIxMDkwOVowfjELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEoMCYGA1UEAxMfTWljcm9zb2Z0
// SIG // IENvZGUgU2lnbmluZyBQQ0EgMjAxMTCCAiIwDQYJKoZI
// SIG // hvcNAQEBBQADggIPADCCAgoCggIBAKvw+nIQHC6t2G6q
// SIG // ghBNNLrytlghn0IbKmvpWlCquAY4GgRJun/DDB7dN2vG
// SIG // EtgL8DjCmQawyDnVARQxQtOJDXlkh36UYCRsr55JnOlo
// SIG // XtLfm1OyCizDr9mpK656Ca/XllnKYBoF6WZ26DJSJhIv
// SIG // 56sIUM+zRLdd2MQuA3WraPPLbfM6XKEW9Ea64DhkrG5k
// SIG // NXimoGMPLdNAk/jj3gcN1Vx5pUkp5w2+oBN3vpQ97/vj
// SIG // K1oQH01WKKJ6cuASOrdJXtjt7UORg9l7snuGG9k+sYxd
// SIG // 6IlPhBryoS9Z5JA7La4zWMW3Pv4y07MDPbGyr5I4ftKd
// SIG // gCz1TlaRITUlwzluZH9TupwPrRkjhMv0ugOGjfdf8NBS
// SIG // v4yUh7zAIXQlXxgotswnKDglmDlKNs98sZKuHCOnqWbs
// SIG // YR9q4ShJnV+I4iVd0yFLPlLEtVc/JAPw0XpbL9Uj43Bd
// SIG // D1FGd7P4AOG8rAKCX9vAFbO9G9RVS+c5oQ/pI0m8GLhE
// SIG // fEXkwcNyeuBy5yTfv0aZxe/CHFfbg43sTUkwp6uO3+xb
// SIG // n6/83bBm4sGXgXvt1u1L50kppxMopqd9Z4DmimJ4X7Iv
// SIG // hNdXnFy/dygo8e1twyiPLI9AN0/B4YVEicQJTMXUpUMv
// SIG // dJX3bvh4IFgsE11glZo+TzOE2rCIF96eTvSWsLxGoGyY
// SIG // 0uDWiIwLAgMBAAGjggHtMIIB6TAQBgkrBgEEAYI3FQEE
// SIG // AwIBADAdBgNVHQ4EFgQUSG5k5VAF04KqFzc3IrVtqMp1
// SIG // ApUwGQYJKwYBBAGCNxQCBAweCgBTAHUAYgBDAEEwCwYD
// SIG // VR0PBAQDAgGGMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0j
// SIG // BBgwFoAUci06AjGQQ7kUBU7h6qfHMdEjiTQwWgYDVR0f
// SIG // BFMwUTBPoE2gS4ZJaHR0cDovL2NybC5taWNyb3NvZnQu
// SIG // Y29tL3BraS9jcmwvcHJvZHVjdHMvTWljUm9vQ2VyQXV0
// SIG // MjAxMV8yMDExXzAzXzIyLmNybDBeBggrBgEFBQcBAQRS
// SIG // MFAwTgYIKwYBBQUHMAKGQmh0dHA6Ly93d3cubWljcm9z
// SIG // b2Z0LmNvbS9wa2kvY2VydHMvTWljUm9vQ2VyQXV0MjAx
// SIG // MV8yMDExXzAzXzIyLmNydDCBnwYDVR0gBIGXMIGUMIGR
// SIG // BgkrBgEEAYI3LgMwgYMwPwYIKwYBBQUHAgEWM2h0dHA6
// SIG // Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvZG9jcy9w
// SIG // cmltYXJ5Y3BzLmh0bTBABggrBgEFBQcCAjA0HjIgHQBM
// SIG // AGUAZwBhAGwAXwBwAG8AbABpAGMAeQBfAHMAdABhAHQA
// SIG // ZQBtAGUAbgB0AC4gHTANBgkqhkiG9w0BAQsFAAOCAgEA
// SIG // Z/KGpZjgVHkaLtPYdGcimwuWEeFjkplCln3SeQyQwWVf
// SIG // Liw++MNy0W2D/r4/6ArKO79HqaPzadtjvyI1pZddZYSQ
// SIG // fYtGUFXYDJJ80hpLHPM8QotS0LD9a+M+By4pm+Y9G6XU
// SIG // tR13lDni6WTJRD14eiPzE32mkHSDjfTLJgJGKsKKELuk
// SIG // qQUMm+1o+mgulaAqPyprWEljHwlpblqYluSD9MCP80Yr
// SIG // 3vw70L01724lruWvJ+3Q3fMOr5kol5hNDj0L8giJ1h/D
// SIG // Mhji8MUtzluetEk5CsYKwsatruWy2dsViFFFWDgycSca
// SIG // f7H0J/jeLDogaZiyWYlobm+nt3TDQAUGpgEqKD6CPxNN
// SIG // ZgvAs0314Y9/HG8VfUWnduVAKmWjw11SYobDHWM2l4bf
// SIG // 2vP48hahmifhzaWX0O5dY0HjWwechz4GdwbRBrF1HxS+
// SIG // YWG18NzGGwS+30HHDiju3mUv7Jf2oVyW2ADWoUa9WfOX
// SIG // pQlLSBCZgB/QACnFsZulP0V3HjXG0qKin3p6IvpIlR+r
// SIG // +0cjgPWe+L9rt0uX4ut1eBrs6jeZeRhL/9azI2h15q/6
// SIG // /IvrC4DqaTuv/DDtBEyO3991bWORPdGdVk5Pv4BXIqF4
// SIG // ETIheu9BCrE/+6jMpF3BoYibV3FWTkhFwELJm3ZbCoBI
// SIG // a/15n8G9bW1qyVJzEw16UM0xghomMIIaIgIBATCBlTB+
// SIG // MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
// SIG // bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
// SIG // cm9zb2Z0IENvcnBvcmF0aW9uMSgwJgYDVQQDEx9NaWNy
// SIG // b3NvZnQgQ29kZSBTaWduaW5nIFBDQSAyMDExAhMzAAAE
// SIG // BGx0Bv9XKydyAAAAAAQEMA0GCWCGSAFlAwQCAQUAoIGu
// SIG // MBkGCSqGSIb3DQEJAzEMBgorBgEEAYI3AgEEMBwGCisG
// SIG // AQQBgjcCAQsxDjAMBgorBgEEAYI3AgEVMC8GCSqGSIb3
// SIG // DQEJBDEiBCC/oGgJ7xs86tVzCtrVxMpb2TyEGGZ9FMpQ
// SIG // mqdbjQjHRTBCBgorBgEEAYI3AgEMMTQwMqAUgBIATQBp
// SIG // AGMAcgBvAHMAbwBmAHShGoAYaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tMA0GCSqGSIb3DQEBAQUABIIBAF5t7UH8
// SIG // vj54UUTO36Cj8UspchH5Ni2dbUFXyNxswv49GEmQjmX3
// SIG // zBcTN9DFEBnH7uPgH7TsJn3secFv9/aMqOrg6rDidcMb
// SIG // GK4mjEPBrjkDeQxcS4f4D1rf9Tx7pVGdh5X7sFbu2AWV
// SIG // eKr3fsB08IcITKzqaAYaoGqDAt5ei/m3C+vfAViVrcPA
// SIG // 2bONDNqWE4JAZXPbVymWUprOwuu9I7tr0TlGquPGjTmw
// SIG // PApMzTJ/hwdLgoEQP3dwRQ4LgPL54CdUdkgvYnqopAB/
// SIG // g2YyIjv80IUtZbOjxpfRzautMGsxRK/U+mKvwVYsaxtF
// SIG // paxMCl3aHzNOzhxl44obDOd416yhghewMIIXrAYKKwYB
// SIG // BAGCNwMDATGCF5wwgheYBgkqhkiG9w0BBwKggheJMIIX
// SIG // hQIBAzEPMA0GCWCGSAFlAwQCAQUAMIIBWgYLKoZIhvcN
// SIG // AQkQAQSgggFJBIIBRTCCAUECAQEGCisGAQQBhFkKAwEw
// SIG // MTANBglghkgBZQMEAgEFAAQg36Mt82EbxCGTr9ppJ1xI
// SIG // nFPWCv75NAdr91IcMkIM7d8CBmftLaoPsxgTMjAyNTA0
// SIG // MTYwMTA0MzkuMTYxWjAEgAIB9KCB2aSB1jCB0zELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0
// SIG // IElyZWxhbmQgT3BlcmF0aW9ucyBMaW1pdGVkMScwJQYD
// SIG // VQQLEx5uU2hpZWxkIFRTUyBFU046MkExQS0wNUUwLUQ5
// SIG // NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1w
// SIG // IFNlcnZpY2WgghH+MIIHKDCCBRCgAwIBAgITMwAAAfkf
// SIG // Z411q6TxsQABAAAB+TANBgkqhkiG9w0BAQsFADB8MQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDAeFw0yNDA3MjUx
// SIG // ODMxMDlaFw0yNTEwMjIxODMxMDlaMIHTMQswCQYDVQQG
// SIG // EwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
// SIG // BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENv
// SIG // cnBvcmF0aW9uMS0wKwYDVQQLEyRNaWNyb3NvZnQgSXJl
// SIG // bGFuZCBPcGVyYXRpb25zIExpbWl0ZWQxJzAlBgNVBAsT
// SIG // Hm5TaGllbGQgVFNTIEVTTjoyQTFBLTA1RTAtRDk0NzEl
// SIG // MCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2Vy
// SIG // dmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoC
// SIG // ggIBALQ9TB98gB1hzVbJQvggU4/zKXeeSwz7UK4Te1nq
// SIG // hYUXgvcSl0o6G1tWR8x1PFdgTiVImIO3wydgMRlRsqL1
// SIG // LYBmYNvhmrhSpN2Y47C0rKnoWCLFEK4F/q/1QE2lvPzj
// SIG // VsupTshmcGacX1dhF+KgIepm9oWnQLr3W0ZdUCtbXwZU
// SIG // d33XggUBvsm8/SRWeOSzdqbPDXNca+NTfEItylSS2F9I
// SIG // mxGwJJLEeG27Mws72Pr3Uq41sigI0emIGIWgWg8RNigy
// SIG // drEERRRf3oAsSoKIHRd1SCaAhP1rsvTLhIMqXmtR3ou5
// SIG // RRr3S0GR+SaNkEebjfIYjHPGeO0USbiFgjnsiCdWJ0Yo
// SIG // om6VGe9vsKb/C06L9Mh+guR0fw/PgE+L6rT+eyE17A/Q
// SIG // zzqG/LY7bHnz3ECXm1DYqsn8ky+Y+fyftnfhjwnFxGKH
// SIG // lmfp67GUn63eQxzOKLwpg95Yn4GJ84zq8uIIUE/3L5nR
// SIG // 8Ba+siRqYVvxxvBkHfnAeMO8BqToR1SW8uOJBlSvDM2P
// SIG // bN9g8tUx5yYPKe8tbBBs/wNcvOGbeoCLCE2GnHB4QSqe
// SIG // HDlTa36EVVMdhv9E6+w5N36QlPLvuaJajz8CoGbOe45f
// SIG // pTq0VbF9QGBJgJ8gshq6kQM6Rl8pNR7zSAaUjTbkwUJO
// SIG // xQb7vmKYugO0tldk4+pc2FlQb7hhAgMBAAGjggFJMIIB
// SIG // RTAdBgNVHQ4EFgQUie2jupyVySPXoo80uUJEdkZZ4AAw
// SIG // HwYDVR0jBBgwFoAUn6cVXQBeYl2D9OXSZacbUzUZ6XIw
// SIG // XwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIw
// SIG // VGltZS1TdGFtcCUyMFBDQSUyMDIwMTAoMSkuY3JsMGwG
// SIG // CCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9N
// SIG // aWNyb3NvZnQlMjBUaW1lLVN0YW1wJTIwUENBJTIwMjAx
// SIG // MCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNVHSUBAf8E
// SIG // DDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4AwDQYJ
// SIG // KoZIhvcNAQELBQADggIBAGYgCYBW5H+434cf5pmZZxma
// SIG // 6WnvhxqcVsbPCO/b1G/BkKLudDNZ7O4sBtgnHaF2qu1Y
// SIG // KVZDX9bryIaxmKSggV0PkmidjtAb8LiUe1LIE2ijdI/8
// SIG // n936Rw9JLR/hJBLhl7PQwS8re9YrrVZMKMPYkJkpOKCC
// SIG // vEvAKzRqUjs3rrvU3SYwY7GrJriftquU45q4BCsj3t0w
// SIG // KQIqPHHcP29XAQJo7SO7aTWFeT8kSNytTYbg4HxI+ZMp
// SIG // xhf7osz9Tbh0sRf1dZLP9rQhKK4onDOJNTyU0wNEwozW
// SIG // 5KZgXLADJcU8wZ1rKpwQrfXflHfVWtyMPQbOHHK5IAYy
// SIG // 7YN72BmGq+teaH2LVPnbqfi7lNHdsAQxBtZ4Ulh2jvrt
// SIG // sukotwGjSDbf6TjClOpeAFtLg1lB9/Thx9xKhR7U7LGV
// SIG // 2gzo7ckYG6jBppH/CiN6iFQWSdl0KZ4RLkW4fgIKZkZ/
// SIG // 2uNdA5O1bT4NrguNtliwvB/CFZPxXqIkkuLxaHYZ3BXr
// SIG // SdGSt+sMQGtxYj4AXm0VslbWe+t6gw88Q29Jgehy/RxH
// SIG // 02zfuKBwpGWtRypfAdLPEYhQTH/1u/juxD2fsDB/MHZI
// SIG // 2e0m7HXbXUYEQEakfCBT1rq0PrJ+37RIn2qI87ghGoUg
// SIG // HKvOso8EHkzzfWBvW9+EU7q55KQ/sDxkwdVnHDKbC5TN
// SIG // MIIHcTCCBVmgAwIBAgITMwAAABXF52ueAptJmQAAAAAA
// SIG // FTANBgkqhkiG9w0BAQsFADCBiDELMAkGA1UEBhMCVVMx
// SIG // EzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1Jl
// SIG // ZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3Jh
// SIG // dGlvbjEyMDAGA1UEAxMpTWljcm9zb2Z0IFJvb3QgQ2Vy
// SIG // dGlmaWNhdGUgQXV0aG9yaXR5IDIwMTAwHhcNMjEwOTMw
// SIG // MTgyMjI1WhcNMzAwOTMwMTgzMjI1WjB8MQswCQYDVQQG
// SIG // EwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
// SIG // BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENv
// SIG // cnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGlt
// SIG // ZS1TdGFtcCBQQ0EgMjAxMDCCAiIwDQYJKoZIhvcNAQEB
// SIG // BQADggIPADCCAgoCggIBAOThpkzntHIhC3miy9ckeb0O
// SIG // 1YLT/e6cBwfSqWxOdcjKNVf2AX9sSuDivbk+F2Az/1xP
// SIG // x2b3lVNxWuJ+Slr+uDZnhUYjDLWNE893MsAQGOhgfWpS
// SIG // g0S3po5GawcU88V29YZQ3MFEyHFcUTE3oAo4bo3t1w/Y
// SIG // JlN8OWECesSq/XJprx2rrPY2vjUmZNqYO7oaezOtgFt+
// SIG // jBAcnVL+tuhiJdxqD89d9P6OU8/W7IVWTe/dvI2k45GP
// SIG // sjksUZzpcGkNyjYtcI4xyDUoveO0hyTD4MmPfrVUj9z6
// SIG // BVWYbWg7mka97aSueik3rMvrg0XnRm7KMtXAhjBcTyzi
// SIG // YrLNueKNiOSWrAFKu75xqRdbZ2De+JKRHh09/SDPc31B
// SIG // mkZ1zcRfNN0Sidb9pSB9fvzZnkXftnIv231fgLrbqn42
// SIG // 7DZM9ituqBJR6L8FA6PRc6ZNN3SUHDSCD/AQ8rdHGO2n
// SIG // 6Jl8P0zbr17C89XYcz1DTsEzOUyOArxCaC4Q6oRRRuLR
// SIG // vWoYWmEBc8pnol7XKHYC4jMYctenIPDC+hIK12NvDMk2
// SIG // ZItboKaDIV1fMHSRlJTYuVD5C4lh8zYGNRiER9vcG9H9
// SIG // stQcxWv2XFJRXRLbJbqvUAV6bMURHXLvjflSxIUXk8A8
// SIG // FdsaN8cIFRg/eKtFtvUeh17aj54WcmnGrnu3tz5q4i6t
// SIG // AgMBAAGjggHdMIIB2TASBgkrBgEEAYI3FQEEBQIDAQAB
// SIG // MCMGCSsGAQQBgjcVAgQWBBQqp1L+ZMSavoKRPEY1Kc8Q
// SIG // /y8E7jAdBgNVHQ4EFgQUn6cVXQBeYl2D9OXSZacbUzUZ
// SIG // 6XIwXAYDVR0gBFUwUzBRBgwrBgEEAYI3TIN9AQEwQTA/
// SIG // BggrBgEFBQcCARYzaHR0cDovL3d3dy5taWNyb3NvZnQu
// SIG // Y29tL3BraW9wcy9Eb2NzL1JlcG9zaXRvcnkuaHRtMBMG
// SIG // A1UdJQQMMAoGCCsGAQUFBwMIMBkGCSsGAQQBgjcUAgQM
// SIG // HgoAUwB1AGIAQwBBMAsGA1UdDwQEAwIBhjAPBgNVHRMB
// SIG // Af8EBTADAQH/MB8GA1UdIwQYMBaAFNX2VsuP6KJcYmjR
// SIG // PZSQW9fOmhjEMFYGA1UdHwRPME0wS6BJoEeGRWh0dHA6
// SIG // Ly9jcmwubWljcm9zb2Z0LmNvbS9wa2kvY3JsL3Byb2R1
// SIG // Y3RzL01pY1Jvb0NlckF1dF8yMDEwLTA2LTIzLmNybDBa
// SIG // BggrBgEFBQcBAQROMEwwSgYIKwYBBQUHMAKGPmh0dHA6
// SIG // Ly93d3cubWljcm9zb2Z0LmNvbS9wa2kvY2VydHMvTWlj
// SIG // Um9vQ2VyQXV0XzIwMTAtMDYtMjMuY3J0MA0GCSqGSIb3
// SIG // DQEBCwUAA4ICAQCdVX38Kq3hLB9nATEkW+Geckv8qW/q
// SIG // XBS2Pk5HZHixBpOXPTEztTnXwnE2P9pkbHzQdTltuw8x
// SIG // 5MKP+2zRoZQYIu7pZmc6U03dmLq2HnjYNi6cqYJWAAOw
// SIG // Bb6J6Gngugnue99qb74py27YP0h1AdkY3m2CDPVtI1Tk
// SIG // eFN1JFe53Z/zjj3G82jfZfakVqr3lbYoVSfQJL1AoL8Z
// SIG // thISEV09J+BAljis9/kpicO8F7BUhUKz/AyeixmJ5/AL
// SIG // aoHCgRlCGVJ1ijbCHcNhcy4sa3tuPywJeBTpkbKpW99J
// SIG // o3QMvOyRgNI95ko+ZjtPu4b6MhrZlvSP9pEB9s7GdP32
// SIG // THJvEKt1MMU0sHrYUP4KWN1APMdUbZ1jdEgssU5HLcEU
// SIG // BHG/ZPkkvnNtyo4JvbMBV0lUZNlz138eW0QBjloZkWsN
// SIG // n6Qo3GcZKCS6OEuabvshVGtqRRFHqfG3rsjoiV5PndLQ
// SIG // THa1V1QJsWkBRH58oWFsc/4Ku+xBZj1p/cvBQUl+fpO+
// SIG // y/g75LcVv7TOPqUxUYS8vwLBgqJ7Fx0ViY1w/ue10Cga
// SIG // iQuPNtq6TPmb/wrpNPgkNWcr4A245oyZ1uEi6vAnQj0l
// SIG // lOZ0dFtq0Z4+7X6gMTN9vMvpe784cETRkPHIqzqKOghi
// SIG // f9lwY1NNje6CbaUFEMFxBmoQtB1VM1izoXBm8qGCA1kw
// SIG // ggJBAgEBMIIBAaGB2aSB1jCB0zELMAkGA1UEBhMCVVMx
// SIG // EzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1Jl
// SIG // ZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3Jh
// SIG // dGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0IElyZWxhbmQg
// SIG // T3BlcmF0aW9ucyBMaW1pdGVkMScwJQYDVQQLEx5uU2hp
// SIG // ZWxkIFRTUyBFU046MkExQS0wNUUwLUQ5NDcxJTAjBgNV
// SIG // BAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Wi
// SIG // IwoBATAHBgUrDgMCGgMVAKrOVo1ju81QCpiHHcIaoGb8
// SIG // qelGoIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEm
// SIG // MCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENB
// SIG // IDIwMTAwDQYJKoZIhvcNAQELBQACBQDrqXeLMCIYDzIw
// SIG // MjUwNDE2MDAyNTQ3WhgPMjAyNTA0MTcwMDI1NDdaMHcw
// SIG // PQYKKwYBBAGEWQoEATEvMC0wCgIFAOupd4sCAQAwCgIB
// SIG // AAICHnwCAf8wBwIBAAICEx0wCgIFAOuqyQsCAQAwNgYK
// SIG // KwYBBAGEWQoEAjEoMCYwDAYKKwYBBAGEWQoDAqAKMAgC
// SIG // AQACAwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsF
// SIG // AAOCAQEAVxGnrY/9XDnDKIZA+k7d8uCVxJH84pfMC+VO
// SIG // BUL0dLJ5blm5C+0aD92imaN+HmIqeszfT7TgAfv+8HKo
// SIG // Aue4I/7cGx7MHEHvdQ+DqGg7QQ2NFpDzDtHUc5ox6PkY
// SIG // 5Ah90GW6/HzgBS7gmGaxgT60KBIyZamogDgnSHLK/IWG
// SIG // z2hVXTHjw5rwewsKFj4Rj41caZ6Gs0bzPCNtqGgG5sZF
// SIG // fU9JN24rkNzwv3zF5Sqxt51GnOCfQBh4wiW8c/dB+cS5
// SIG // X8fpl1tpES+RtxOsKz+Uwm+T8Lp64o8dD630GZwC+7gN
// SIG // VVPa44LNUiZQmz3CrYuZac2aQKRTFl8oq+pig7J4ADGC
// SIG // BA0wggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYD
// SIG // VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
// SIG // MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // JjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBD
// SIG // QSAyMDEwAhMzAAAB+R9njXWrpPGxAAEAAAH5MA0GCWCG
// SIG // SAFlAwQCAQUAoIIBSjAaBgkqhkiG9w0BCQMxDQYLKoZI
// SIG // hvcNAQkQAQQwLwYJKoZIhvcNAQkEMSIEID2qxXCt8V5Q
// SIG // 2tfsyFVu99sjumBRrEQOubRB2joRMDruMIH6BgsqhkiG
// SIG // 9w0BCRACLzGB6jCB5zCB5DCBvQQgOSOMyB7wjftk+ukV
// SIG // Diwma1BFXaCpSpfFXgjuUmxi2BAwgZgwgYCkfjB8MQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAfkfZ411
// SIG // q6TxsQABAAAB+TAiBCA2r+REEjeLmBJGq5vC1sqYGeD5
// SIG // rN1EYXR1+NnV3t1q3DANBgkqhkiG9w0BAQsFAASCAgAC
// SIG // 1t9FnRp01Jq+flriSqP229duOONoNO+b+xxOzkqF4Kht
// SIG // n+GcgUJm5HK7YiBZIeJVdsdStUmmS5R+NYX4jM8CyA8U
// SIG // +BHEy1uG6QFbb6nHA3PWMcW+lZoMy3IbCRka/O0NcHSV
// SIG // ByRBise6lsqYt8n88Rf2hsSdcnlswh2uJL/Bok0MZe6k
// SIG // bK6rqcFo6ChJoy+rNQCxQJLDdfpZ7LWsRRVyXUHM40ER
// SIG // MTFJStTLWc6JNQcriP/aGaVR3DDnm6CHtHFVkYdhnTRS
// SIG // TS5Z/aMf3cKcXLkiiFaRcyrwMvMMTtLKZOYwcAhH+08s
// SIG // AhfxuGYwwK5bu1fud1S8cWMappMJlrHNJwG3dEGTrDFD
// SIG // PHNRHzy26KI0xh92Qbr/u4JHsFoTJHLYBLROGeO2v2Ln
// SIG // 1DjOr2qxxLQHz7wmTl+M5JM0q6jUfIEjKoJ2Ygw2q0nj
// SIG // Wx2mZ+99LbDw1mpRNqPQy5tcv7Cblwy2j/wnSWX5izTu
// SIG // A7XGkBK079XnQC8k4gWvubZ7ZjI7d8vlH/s2LGbunytR
// SIG // L8sdz+w9TBMqhMo3zKxW59zrEAcWrVXjPkW+s+FjN8gy
// SIG // BvPGyx3T4rYDMBF4L4NHuMlIb786Sgmms030mDCCpCIj
// SIG // FwHRdCTPCgyFkQoRfnCQuOgIB4mV267ywsS4iESIuINc
// SIG // JYrYSh91BVcDB84SVQgcTA==
// SIG // End signature block
