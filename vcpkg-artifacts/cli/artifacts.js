"use strict";
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireArtifacts = exports.selectArtifacts = exports.showArtifacts = void 0;
const cli_progress_1 = require("cli-progress");
const artifact_1 = require("../artifacts/artifact");
const i18n_1 = require("../i18n");
const registries_1 = require("../registries/registries");
const console_table_1 = require("./console-table");
const format_1 = require("./format");
const styling_1 = require("./styling");
async function showArtifacts(artifacts, registries, options) {
    let failing = false;
    const table = new console_table_1.Table((0, i18n_1.i) `Artifact`, (0, i18n_1.i) `Version`, (0, i18n_1.i) `Status`, (0, i18n_1.i) `Dependency`, (0, i18n_1.i) `Summary`);
    for (const resolved of artifacts) {
        const artifact = resolved.artifact;
        if (artifact instanceof artifact_1.Artifact) {
            const name = (0, format_1.artifactIdentity)(registries.getRegistryDisplayName(artifact.registryUri), artifact.id, artifact.shortName);
            for (const err of artifact.metadata.validate()) {
                failing = true;
                (0, styling_1.error)(artifact.metadata.formatVMessage(err));
            }
            table.push(name, artifact.version, options?.force || await artifact.isInstalled ? 'installed' : 'will install', resolved.initialSelection ? ' ' : '*', artifact.metadata.summary || '');
        }
    }
    (0, styling_1.log)(table.toString());
    (0, styling_1.log)();
    return !failing;
}
exports.showArtifacts = showArtifacts;
async function selectArtifacts(session, selections, registries, dependencyDepth) {
    const userSelectedArtifacts = new Map();
    const userSelectedVersions = new Map();
    for (const [idOrShortName, version] of selections) {
        const [, artifact] = await (0, registries_1.getArtifact)(registries, idOrShortName, version) || [];
        if (!artifact) {
            (0, styling_1.error)(`Unable to resolve artifact: ${(0, format_1.addVersionToArtifactIdentity)(idOrShortName, version)}`);
            const results = await registries.search({ keyword: idOrShortName, version: version });
            if (results.length) {
                (0, styling_1.log)('Possible matches:');
                for (const [artifactDisplay, artifactVersions] of results) {
                    for (const artifactVersion of artifactVersions) {
                        (0, styling_1.log)(`  ${(0, format_1.addVersionToArtifactIdentity)(artifactDisplay, artifactVersion.version)}`);
                    }
                }
            }
            return false;
        }
        userSelectedArtifacts.set(artifact.uniqueId, artifact);
        userSelectedVersions.set(artifact.uniqueId, version);
    }
    const allResolved = await (0, artifact_1.resolveDependencies)(session, registries, Array.from(userSelectedArtifacts.values()), dependencyDepth);
    const results = new Array();
    for (const resolved of allResolved) {
        results.push({ ...resolved, 'requestedVersion': userSelectedVersions.get(resolved.uniqueId) });
    }
    return results;
}
exports.selectArtifacts = selectArtifacts;
var TaggedProgressKind;
(function (TaggedProgressKind) {
    TaggedProgressKind[TaggedProgressKind["Unset"] = 0] = "Unset";
    TaggedProgressKind[TaggedProgressKind["Verifying"] = 1] = "Verifying";
    TaggedProgressKind[TaggedProgressKind["Downloading"] = 2] = "Downloading";
    TaggedProgressKind[TaggedProgressKind["GenericProgress"] = 3] = "GenericProgress";
    TaggedProgressKind[TaggedProgressKind["Heartbeat"] = 4] = "Heartbeat";
})(TaggedProgressKind || (TaggedProgressKind = {}));
class TaggedProgressBar {
    multiBar;
    bar;
    kind = TaggedProgressKind.Unset;
    lastCurrentValue = 0;
    constructor(multiBar) {
        this.multiBar = multiBar;
    }
    checkChangeKind(currentValue, kind) {
        this.lastCurrentValue = currentValue;
        if (this.kind !== kind) {
            if (this.bar) {
                this.multiBar.remove(this.bar);
                this.bar = undefined;
            }
            this.kind = kind;
        }
    }
    startOrUpdate(kind, total, currentValue, suffix) {
        this.checkChangeKind(currentValue, kind);
        const payload = { suffix: suffix };
        if (this.bar) {
            this.bar.update(currentValue, payload);
        }
        else {
            this.kind = kind;
            this.bar = this.multiBar.create(total, currentValue, payload, { format: '{bar} {percentage}% {suffix}' });
        }
    }
    heartbeat(suffix) {
        this.checkChangeKind(0, TaggedProgressKind.Heartbeat);
        const payload = { suffix: suffix };
        if (this.bar) {
            this.bar.update(0, payload);
        }
        else {
            const progressUnknown = (0, i18n_1.i) `(progress unknown)`;
            const totalSpaces = 41 - progressUnknown.length;
            const prefixSpaces = Math.floor(totalSpaces / 2);
            const suffixSpaces = totalSpaces - prefixSpaces;
            const prettyProgressUnknown = Array(prefixSpaces).join(' ') + progressUnknown + Array(suffixSpaces).join(' ');
            this.bar = this.multiBar.create(0, 0, payload, { format: '*' + prettyProgressUnknown + '* {suffix}' });
        }
    }
}
class TtyProgressRenderer {
    #bar = new cli_progress_1.MultiBar({
        clearOnComplete: true,
        hideCursor: true,
        barCompleteChar: '*',
        barIncompleteChar: ' ',
        etaBuffer: 40
    });
    #overallProgress;
    #individualProgress;
    constructor(totalArtifactCount) {
        this.#overallProgress = this.#bar.create(totalArtifactCount, 0, { name: '' }, { format: `{bar} [{value}/${totalArtifactCount - 1}] {name}`, emptyOnZero: true });
        this.#individualProgress = new TaggedProgressBar(this.#bar);
    }
    setArtifactIndex(index, displayName) {
        this.#overallProgress.update(index, { name: displayName });
    }
    hashVerifyProgress(file, percent) {
        this.#individualProgress.startOrUpdate(TaggedProgressKind.Verifying, 100, percent, (0, i18n_1.i) `verifying` + ' ' + file);
    }
    downloadProgress(uri, destination, percent) {
        this.#individualProgress.startOrUpdate(TaggedProgressKind.Downloading, 100, percent, (0, i18n_1.i) `downloading ${uri.toString()} -> ${destination}`);
    }
    unpackArchiveStart(archiveUri) {
        this.#individualProgress.heartbeat((0, i18n_1.i) `unpacking ${archiveUri.fsPath}`);
    }
    unpackArchiveHeartbeat(text) {
        this.#individualProgress.heartbeat(text);
    }
    stop() {
        this.#bar.stop();
    }
}
const downloadUpdateRateMs = 10 * 1000;
class NoTtyProgressRenderer {
    channels;
    totalArtifactCount;
    #currentIndex = 0;
    #downloadPrecent = 0;
    #downloadTimeoutId;
    constructor(channels, totalArtifactCount) {
        this.channels = channels;
        this.totalArtifactCount = totalArtifactCount;
    }
    setArtifactIndex(index) {
        this.#currentIndex = index;
    }
    startInstallArtifact(displayName) {
        this.channels.message(`[${this.#currentIndex + 1}/${this.totalArtifactCount - 1}] ` + (0, i18n_1.i) `Installing ${displayName}...`);
    }
    alreadyInstalledArtifact(displayName) {
        this.channels.message(`[${this.#currentIndex + 1}/${this.totalArtifactCount - 1}] ` + (0, i18n_1.i) `${displayName} already installed.`);
    }
    downloadStart(uris, destination) {
        let displayUri;
        if (uris.length === 1) {
            displayUri = uris[0].toString();
        }
        else {
            displayUri = JSON.stringify(uris.map(uri => uri.toString()));
        }
        this.channels.message((0, i18n_1.i) `Downloading ${displayUri}...`);
        this.#downloadTimeoutId = setTimeout(this.downloadProgressDisplay.bind(this), downloadUpdateRateMs);
    }
    downloadProgress(uri, destination, percent) {
        this.#downloadPrecent = percent;
    }
    downloadProgressDisplay() {
        this.channels.message(`${this.#downloadPrecent}%`);
        this.#downloadTimeoutId = setTimeout(this.downloadProgressDisplay.bind(this), downloadUpdateRateMs);
    }
    downloadComplete() {
        if (this.#downloadTimeoutId) {
            clearTimeout(this.#downloadTimeoutId);
        }
    }
    stop() {
        if (this.#downloadTimeoutId) {
            clearTimeout(this.#downloadTimeoutId);
        }
    }
    unpackArchiveStart(archiveUri) {
        this.channels.message((0, i18n_1.i) `Unpacking ${archiveUri.fsPath}...`);
    }
}
async function acquireArtifacts(session, resolved, registries, options) {
    // resolve the full set of artifacts to install.
    const isTty = process.stdout.isTTY === true;
    const progressRenderer = isTty ? new TtyProgressRenderer(resolved.length) : new NoTtyProgressRenderer(session.channels, resolved.length);
    for (let idx = 0; idx < resolved.length; ++idx) {
        const artifact = resolved[idx].artifact;
        if (artifact instanceof artifact_1.Artifact) {
            const id = artifact.id;
            const registryName = registries.getRegistryDisplayName(artifact.registryUri);
            const artifactDisplayName = (0, format_1.artifactIdentity)(registryName, id, artifact.shortName);
            progressRenderer.setArtifactIndex?.(idx, artifactDisplayName);
            try {
                const installStatus = await artifact.install(artifactDisplayName, progressRenderer, options || {});
                switch (installStatus) {
                    case artifact_1.InstallStatus.Installed:
                        session.trackAcquire(artifact.registryUri.toString(), id, artifact.version);
                        break;
                    case artifact_1.InstallStatus.AlreadyInstalled:
                        break;
                    case artifact_1.InstallStatus.Failed:
                        progressRenderer.stop?.();
                        return false;
                }
            }
            catch (e) {
                progressRenderer.stop?.();
                (0, styling_1.debug)(e);
                (0, styling_1.debug)(e.stack);
                (0, styling_1.error)((0, i18n_1.i) `Error installing ${artifactDisplayName} - ${e}`);
                return false;
            }
        }
    }
    progressRenderer.stop?.();
    return true;
}
exports.acquireArtifacts = acquireArtifacts;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJ0aWZhY3RzLmpzIiwic291cmNlUm9vdCI6Imh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9taWNyb3NvZnQvdmNwa2ctdG9vbC9tYWluL3ZjcGtnLWFydGlmYWN0cy8iLCJzb3VyY2VzIjpbImNsaS9hcnRpZmFjdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHVDQUF1QztBQUN2QyxrQ0FBa0M7OztBQUVsQywrQ0FBbUQ7QUFDbkQsb0RBQWlJO0FBQ2pJLGtDQUE0QjtBQUU1Qix5REFBaUc7QUFJakcsbURBQXdDO0FBQ3hDLHFDQUEwRTtBQUMxRSx1Q0FBOEM7QUFFdkMsS0FBSyxVQUFVLGFBQWEsQ0FBQyxTQUFxQyxFQUFFLFVBQWtDLEVBQUUsT0FBNkI7SUFDMUksSUFBSSxPQUFPLEdBQUcsS0FBSyxDQUFDO0lBQ3BCLE1BQU0sS0FBSyxHQUFHLElBQUkscUJBQUssQ0FBQyxJQUFBLFFBQUMsRUFBQSxVQUFVLEVBQUUsSUFBQSxRQUFDLEVBQUEsU0FBUyxFQUFFLElBQUEsUUFBQyxFQUFBLFFBQVEsRUFBRSxJQUFBLFFBQUMsRUFBQSxZQUFZLEVBQUUsSUFBQSxRQUFDLEVBQUEsU0FBUyxDQUFDLENBQUM7SUFDdkYsS0FBSyxNQUFNLFFBQVEsSUFBSSxTQUFTLEVBQUU7UUFDaEMsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLFFBQVEsQ0FBQztRQUNuQyxJQUFJLFFBQVEsWUFBWSxtQkFBUSxFQUFFO1lBQ2hDLE1BQU0sSUFBSSxHQUFHLElBQUEseUJBQWdCLEVBQUMsVUFBVSxDQUFDLHNCQUFzQixDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsRUFBRSxRQUFRLENBQUMsRUFBRSxFQUFFLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN4SCxLQUFLLE1BQU0sR0FBRyxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLEVBQUU7Z0JBQzlDLE9BQU8sR0FBRyxJQUFJLENBQUM7Z0JBQ2YsSUFBQSxlQUFLLEVBQUMs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
// SIG // Begin signature block
// SIG // MIIoRAYJKoZIhvcNAQcCoIIoNTCCKDECAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // jexLa/xbS7GZkSj0ofTjTuvF2YREB32UVIFXqwUzDJ+g
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
// SIG // DQEJBDEiBCAMYRRIXHu78fBZfc14H6VTQsFQgYGKIWET
// SIG // TNhbT4LiRTBCBgorBgEEAYI3AgEMMTQwMqAUgBIATQBp
// SIG // AGMAcgBvAHMAbwBmAHShGoAYaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tMA0GCSqGSIb3DQEBAQUABIIBAAt4uena
// SIG // lO5t9fUBdY3Y4X3asYN9Q1rX5EmPYTyGU0oXTKI8TU9X
// SIG // 91u06bqzwAjsl0IeaJnrM/L/9h30S2o/pQATbtlAyIFW
// SIG // OcWDVAohYl2YITEhgq+4tltrh7PXWuY4JyFWzO7MYqIe
// SIG // hfu/oZIlWbX7hEj/V8spjSxTLz/h0WLA5V4LgIwOufUw
// SIG // ERGBNb5WyLO9YtIv+blg/pXuKPO+i4hDTsiPtWNLRvsZ
// SIG // ENarF2RUqD/u9SgzDPiy7lfWPyWnbERovSunsgptUKMo
// SIG // 0JeAuhWbS2/S5WjQrDF+v65LcViNpjaivVcc8+NswYiD
// SIG // Msk3gbZf3hXXkfJSdviBSjFw/1ahghewMIIXrAYKKwYB
// SIG // BAGCNwMDATGCF5wwgheYBgkqhkiG9w0BBwKggheJMIIX
// SIG // hQIBAzEPMA0GCWCGSAFlAwQCAQUAMIIBWgYLKoZIhvcN
// SIG // AQkQAQSgggFJBIIBRTCCAUECAQEGCisGAQQBhFkKAwEw
// SIG // MTANBglghkgBZQMEAgEFAAQg1jN3lCylcECLmDbY7BBQ
// SIG // asmhqMY+a0gjfyTcf5EInGECBmftNv7lnBgTMjAyNTA0
// SIG // MTYwMTA1MDcuMTY3WjAEgAIB9KCB2aSB1jCB0zELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0
// SIG // IElyZWxhbmQgT3BlcmF0aW9ucyBMaW1pdGVkMScwJQYD
// SIG // VQQLEx5uU2hpZWxkIFRTUyBFU046NDAxQS0wNUUwLUQ5
// SIG // NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1w
// SIG // IFNlcnZpY2WgghH+MIIHKDCCBRCgAwIBAgITMwAAAf7Q
// SIG // qMJ7NCELAQABAAAB/jANBgkqhkiG9w0BAQsFADB8MQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDAeFw0yNDA3MjUx
// SIG // ODMxMThaFw0yNTEwMjIxODMxMThaMIHTMQswCQYDVQQG
// SIG // EwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
// SIG // BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENv
// SIG // cnBvcmF0aW9uMS0wKwYDVQQLEyRNaWNyb3NvZnQgSXJl
// SIG // bGFuZCBPcGVyYXRpb25zIExpbWl0ZWQxJzAlBgNVBAsT
// SIG // Hm5TaGllbGQgVFNTIEVTTjo0MDFBLTA1RTAtRDk0NzEl
// SIG // MCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2Vy
// SIG // dmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoC
// SIG // ggIBALy8IRcVpagON6JbBODwnoGeJkn7B9mE0ihGL/Bp
// SIG // 99+tgZmsnHX+U97UMaT9zVputmB1IniEF8PtLuKpWsuA
// SIG // DdyKJyPuOzaYvX6OdsXQFzF9KRq3NHqlvEVjd2381zyr
// SIG // 9OztfIth4w8i7ssGMigPRZlm3j42oX/TMHfEIMoJD7cA
// SIG // 61UBi8jpMjN1U4hyqoRrvQQhlUXR1vZZjzK61JT1omFf
// SIG // S1QgeVWHfgBFLXX6gHapc1cQOdxIMUqoaeiW3xCp03XH
// SIG // z+k/DIq9B68E07VdodsgwbY120CGqsnCjm+t9xn0ZJ9t
// SIG // eizgwYN+z/8cIaHV0/NWQtmhze3sRA5pm4lrLIxrxSZJ
// SIG // YtoOnbdNXkoTohpoW6J69Kl13AXqjW+kKBfI1/7g1bWP
// SIG // aby+I/GhFkuPYSlB9Js7ArnCK8FEvsfDLk9Ln+1VwhTR
// SIG // W4glDUU6H8SdweOeHhiYS9H8FE0W4Mgm6S4CjCg4gkbm
// SIG // +uQ4Wng71AACU/dykgqHhQqJJT2r24EMmoRmQy/71gFY
// SIG // 1+W/Cc4ZcvYBgnSv6ouovnMWdEvMegdsoz22X3QVXx/z
// SIG // Qaf9S5+8W3jhEwDp+zk/Q91BrdKvioloGONh5y48oZdW
// SIG // wLuR34K8gDtwwmiHVdrY75CWstqjpxew4I/GutCkE/UI
// SIG // HyX8F5692Som2DI2lGwjSA58c9spAgMBAAGjggFJMIIB
// SIG // RTAdBgNVHQ4EFgQUb857ifUlNoOZf+f2/uQgYm2xxd0w
// SIG // HwYDVR0jBBgwFoAUn6cVXQBeYl2D9OXSZacbUzUZ6XIw
// SIG // XwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIw
// SIG // VGltZS1TdGFtcCUyMFBDQSUyMDIwMTAoMSkuY3JsMGwG
// SIG // CCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9N
// SIG // aWNyb3NvZnQlMjBUaW1lLVN0YW1wJTIwUENBJTIwMjAx
// SIG // MCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNVHSUBAf8E
// SIG // DDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4AwDQYJ
// SIG // KoZIhvcNAQELBQADggIBAIk+DVLztpcPtHQzLbAbsZl9
// SIG // qN5VUKp0JLiEwBiBgoCPrJe2amTkw3fC6sbB+Blgj087
// SIG // XN7a/AIAb7GCM1oxcIqAowkDg6taATFjcxLCs3JB8QM2
// SIG // KOUs3uzj5DANwwMVauEkkfMvk0QthnDndCUXmdZT5YZT
// SIG // 5fVyPs/DoLTj5kJyy4j/as6Ux8Bc3vrG6kp/HHpHbjGX
// SIG // S8hyZNzYsNwJ4JVP1k8xrEAHXIfUlVeCx4n1J5sE39It
// SIG // O4irU5TZKt28dYsloOze4xmQAUVk9pl/mAFR5Stu7fZ/
// SIG // lrWG5+nDiTV+i7B/MT1QUWACEVZFrDMhAHaD/Xan2mc8
// SIG // Fxpo7lUPd9TYcx44xvhH8NdfA145N1at6lCNa3t+MzDE
// SIG // 0c2WRMPNhbqRd74lzUdw1TpUvSR+MeXpnyDWtbrkmnOh
// SIG // eAniQg9RmpH0uw+WsjbGmdnvrAVIetilU5YRLEER2UcA
// SIG // k8W4sdWOIicPjwzS3NB39fal9l4l9LtkjPQlk047M/Ur
// SIG // woyCksQmRQjb/86SiJbB8e4UDUB0jGyodP8MJ/OroiAC
// SIG // xI2s1LMxNPl+q3Dmw31OIfzv9L5mxdwTEfuOawGTABEy
// SIG // bEQz8RyQqP+VxoVnYPy6CeV1gazgy+OGDazexUZxxAAK
// SIG // 9OrH5amfHnldxbgynT+YdfVlJxlsDtR/2Y1MzqFRold4
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
// SIG // ZWxkIFRTUyBFU046NDAxQS0wNUUwLUQ5NDcxJTAjBgNV
// SIG // BAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Wi
// SIG // IwoBATAHBgUrDgMCGgMVAIRjRw/2u0NG0C1lRvSbhsYC
// SIG // 0V7HoIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEm
// SIG // MCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENB
// SIG // IDIwMTAwDQYJKoZIhvcNAQELBQACBQDrqNgfMCIYDzIw
// SIG // MjUwNDE1MTMwNTM1WhgPMjAyNTA0MTYxMzA1MzVaMHcw
// SIG // PQYKKwYBBAGEWQoEATEvMC0wCgIFAOuo2B8CAQAwCgIB
// SIG // AAICHOoCAf8wBwIBAAICE3IwCgIFAOuqKZ8CAQAwNgYK
// SIG // KwYBBAGEWQoEAjEoMCYwDAYKKwYBBAGEWQoDAqAKMAgC
// SIG // AQACAwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsF
// SIG // AAOCAQEAu6pSnERiwcK9GO6LyIrHK3NhOhI4fHYADsew
// SIG // APij5ljSBUZxcNXtQkgTUhBgxFwtbpEi6H7Z4eRhaCr8
// SIG // 2mwjj/RjOTGYigH98PY8plj71/j+xgpoX+mYF8Ji9L9n
// SIG // ke5hCoXsq3lpbkueNdYNJGCgOMC6VrdwsTdcooHxkUrT
// SIG // CFncjA0Yb+Esp9jm7sTORUbqMDpN1PuqlT/aBYm+Ogvy
// SIG // Bv5zjsJ2ZjxVLCraPSyfIohnpqT1kXlXa0qsa0lQkJAt
// SIG // wvQCLCNiWKadxZIh1U40zi+I7YkjxzE/pl5oWIHJ0T3g
// SIG // JzsLSWM5oxHNjTsGb5TPq3wKsEm1guSDlwFv/CofwDGC
// SIG // BA0wggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYD
// SIG // VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
// SIG // MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // JjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBD
// SIG // QSAyMDEwAhMzAAAB/tCowns0IQsBAAEAAAH+MA0GCWCG
// SIG // SAFlAwQCAQUAoIIBSjAaBgkqhkiG9w0BCQMxDQYLKoZI
// SIG // hvcNAQkQAQQwLwYJKoZIhvcNAQkEMSIEIMHU6VJQ4By/
// SIG // kORGud1ioK8u3WpdiBY/pwrcwNwiFz0zMIH6BgsqhkiG
// SIG // 9w0BCRACLzGB6jCB5zCB5DCBvQQgEYXM3fxTyJ8Y0fdp
// SIG // toT1qnPrxjhtfvyNFrZArLcodHkwgZgwgYCkfjB8MQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAf7QqMJ7
// SIG // NCELAQABAAAB/jAiBCAHYe7elml2E+J1N7A/NG+yjZjP
// SIG // r0woM8i8a7hb+T92MzANBgkqhkiG9w0BAQsFAASCAgAJ
// SIG // MEUyo2YTsY3Y9bc1sZMuGaUhVBrzf8BsfzZNJ6dArm/p
// SIG // A66hWV4/1C77DYXZLbBqKlkllKhLsKo4NnhfZu7twgt/
// SIG // qrFKD4frbmaHKh7rhi4B8DmRisZjUavOm4UlR0aQ5NfU
// SIG // tpDW43FoA+FOnT8hlYNp3TM/j2HULdXYZPCymp4ivSEP
// SIG // VlIMOGkatIylvhihe4Ij/hqi2Gu60uR6JFhRCTeqdSVz
// SIG // 8zw2ZNfV35X+tAnZKUkBiBwN/scDdG6fMJHeet/05p1x
// SIG // lcOMnxzngto+/pKpd0jZv0551aAx+00Ed2XWPrwHIsyE
// SIG // 0SxImFIXSzcKCAM1GNiZOFVpOuoxUgpIxIO8Zhcylv0y
// SIG // d7F3s9+hy6QEHrDOwiWsM0Ua7ovvOGIZ+8RbjT1ttuYl
// SIG // fyk4BwhgWR9IYVlsj48jUURFeuV1m45e6ONq28WwGgZW
// SIG // bvVBnVVKO0iCOpBZgPGLWQTMqV0NXsi+zIh86WOXuJ+3
// SIG // y/2sbDFrKwdaBHHhOsJtdBJE9+3+JGLsuTly38BaDjTU
// SIG // 3BnLMiych9BYjtswCqJ9dgTFOHmWV9Ok063VfdJC6ojT
// SIG // 4CbxCugzbGkhyZLIqlfZc9fBMHmRbQuVJzpc9Ydql90l
// SIG // /2PyxCOIqEzOb3gxHmvpMBumCZ1a533CksM+Gjp/DGUh
// SIG // HoQXpFXbA9VejyBiR7ncTg==
// SIG // End signature block
