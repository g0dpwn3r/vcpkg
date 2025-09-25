"use strict";
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Git = void 0;
const exec_cmd_1 = require("../util/exec-cmd");
const uri_1 = require("../util/uri");
/** @internal */
class Git {
    #toolPath;
    #targetFolder;
    constructor(toolPath, targetFolder) {
        this.#toolPath = toolPath;
        this.#targetFolder = targetFolder;
    }
    /**
     * Method that clones a git repo into a desired location and with various options.
     * @param repo The Uri of the remote repository that is desired to be cloned.
     * @param events The events that may need to be updated in order to track progress.
     * @param options The options that will modify how the clone will be called.
     * @returns Boolean representing whether the execution was completed without error, this is not necessarily
     *  a guarantee that the clone did what we expected.
     */
    async clone(repo, events, options = {}) {
        const remote = await (0, uri_1.isFilePath)(repo) ? repo.fsPath : repo.toString();
        const result = await (0, exec_cmd_1.execute)(this.#toolPath, [
            'clone',
            remote,
            this.#targetFolder.fsPath,
            options.recursive ? '--recursive' : '',
            options.depth ? `--depth=${options.depth}` : '',
            '--progress'
        ], {
            onStdErrData: chunkToHeartbeat(events),
            onStdOutData: chunkToHeartbeat(events)
        });
        return result.code === 0 ? true : false;
    }
    /**
     * Fetches a 'tag', this could theoretically be a commit, a tag, or a branch.
     * @param remoteName Remote name to fetch from. Typically will be 'origin'.
     * @param events Events that may be called in order to present progress.
     * @param options Options to modify how fetch is called.
     * @returns Boolean representing whether the execution was completed without error, this is not necessarily
     *  a guarantee that the fetch did what we expected.
     */
    async fetch(remoteName, events, options = {}) {
        const result = await (0, exec_cmd_1.execute)(this.#toolPath, [
            '-C',
            this.#targetFolder.fsPath,
            'fetch',
            remoteName,
            options.commit ? options.commit : '',
            options.depth ? `--depth=${options.depth}` : ''
        ], {
            cwd: this.#targetFolder.fsPath
        });
        return result.code === 0 ? true : false;
    }
    /**
     * Checks out a specific commit. If no commit is given, the default behavior of a checkout will be
     * used. (Checking out the current branch)
     * @param events Events to possibly track progress.
     * @param options Passing along a commit or branch to checkout, optionally.
     * @returns Boolean representing whether the execution was completed without error, this is not necessarily
     *  a guarantee that the checkout did what we expected.
     */
    async checkout(events, options = {}) {
        const result = await (0, exec_cmd_1.execute)(this.#toolPath, [
            '-C',
            this.#targetFolder.fsPath,
            'checkout',
            options.commit ? options.commit : ''
        ], {
            cwd: this.#targetFolder.fsPath,
            onStdErrData: chunkToHeartbeat(events),
            onStdOutData: chunkToHeartbeat(events)
        });
        return result.code === 0 ? true : false;
    }
    /**
     * Performs a reset on the git repo.
     * @param events Events to possibly track progress.
     * @param options Options to control how the reset is called.
     * @returns Boolean representing whether the execution was completed without error, this is not necessarily
     *  a guarantee that the reset did what we expected.
     */
    async reset(events, options = {}) {
        const result = await (0, exec_cmd_1.execute)(this.#toolPath, [
            '-C',
            this.#targetFolder.fsPath,
            'reset',
            options.commit ? options.commit : '',
            options.recurse ? '--recurse-submodules' : '',
            options.hard ? '--hard' : ''
        ], {
            cwd: this.#targetFolder.fsPath,
            onStdErrData: chunkToHeartbeat(events),
            onStdOutData: chunkToHeartbeat(events)
        });
        return result.code === 0 ? true : false;
    }
    /**
     * Initializes a folder on disk to be a git repository
     * @returns true if the initialization was successful, false otherwise.
     */
    async init() {
        if (!await this.#targetFolder.exists()) {
            await this.#targetFolder.createDirectory();
        }
        if (!await this.#targetFolder.isDirectory()) {
            throw new Error(`${this.#targetFolder.fsPath} is not a directory.`);
        }
        const result = await (0, exec_cmd_1.execute)(this.#toolPath, ['init'], {
            cwd: this.#targetFolder.fsPath
        });
        return result.code === 0 ? true : false;
    }
    /**
     * Adds a remote location to the git repo.
     * @param name the name of the remote to add.
     * @param location the location of the remote to add.
     * @returns true if the addition was successful, false otherwise.
     */
    async addRemote(name, location) {
        const result = await (0, exec_cmd_1.execute)(this.#toolPath, [
            '-C',
            this.#targetFolder.fsPath,
            'remote',
            'add',
            name,
            location.toString()
        ], {
            cwd: this.#targetFolder.fsPath
        });
        return result.code === 0;
    }
    /**
     * updates submodules in a git repository
     * @param events Events to possibly track progress.
     * @param options Options to control how the submodule update is called.
     * @returns true if the update was successful, false otherwise.
     */
    async updateSubmodules(events, options = {}) {
        const result = await (0, exec_cmd_1.execute)(this.#toolPath, [
            '-C',
            this.#targetFolder.fsPath,
            'submodule',
            'update',
            '--progress',
            options.init ? '--init' : '',
            options.depth ? `--depth=${options.depth}` : '',
            options.recursive ? '--recursive' : '',
        ], {
            cwd: this.#targetFolder.fsPath,
            onStdErrData: chunkToHeartbeat(events),
            onStdOutData: chunkToHeartbeat(events)
        });
        return result.code === 0;
    }
    /**
     * sets a git configuration value in the repo.
     * @param configFile the relative path to the config file inside the repo on disk
     * @param key the key to set in the config file
     * @param value the value to set in the config file
     * @returns true if the config file was updated, false otherwise
     */
    async config(configFile, key, value) {
        const result = await (0, exec_cmd_1.execute)(this.#toolPath, [
            'config',
            '-f',
            this.#targetFolder.join(configFile).fsPath,
            key,
            value
        ], {
            cwd: this.#targetFolder.fsPath
        });
        return result.code === 0;
    }
}
exports.Git = Git;
function chunkToHeartbeat(events) {
    return (chunk) => {
        const regex = /\s([0-9]*?)%/;
        chunk.toString().split(/^/gim).map((x) => x.trim()).filter((each) => each).forEach((line) => {
            const match_array = line.match(regex);
            if (match_array !== null) {
                events.unpackArchiveHeartbeat?.(line.trim());
            }
        });
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0LmpzIiwic291cmNlUm9vdCI6Imh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9taWNyb3NvZnQvdmNwa2ctdG9vbC9tYWluL3ZjcGtnLWFydGlmYWN0cy8iLCJzb3VyY2VzIjpbImFyY2hpdmVycy9naXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHVDQUF1QztBQUN2QyxrQ0FBa0M7OztBQUdsQywrQ0FBMkM7QUFDM0MscUNBQThDO0FBTTlDLGdCQUFnQjtBQUNoQixNQUFhLEdBQUc7SUFDZCxTQUFTLENBQVM7SUFDbEIsYUFBYSxDQUFNO0lBRW5CLFlBQVksUUFBZ0IsRUFBRSxZQUFpQjtRQUM3QyxJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQztRQUMxQixJQUFJLENBQUMsYUFBYSxHQUFHLFlBQVksQ0FBQztJQUNwQyxDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNILEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBUyxFQUFFLE1BQTZCLEVBQUUsVUFBbUQsRUFBRTtRQUN6RyxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUEsZ0JBQVUsRUFBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBRXRFLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBQSxrQkFBTyxFQUFDLElBQUksQ0FBQyxTQUFTLEVBQUU7WUFDM0MsT0FBTztZQUNQLE1BQU07WUFDTixJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU07WUFDekIsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ3RDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFdBQVcsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQy9DLFlBQVk7U0FDYixFQUFFO1lBQ0QsWUFBWSxFQUFFLGdCQUFnQixDQUFDLE1B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
// SIG // Begin signature block
// SIG // MIIoQQYJKoZIhvcNAQcCoIIoMjCCKC4CAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // Kv9xrD1WYPeNDTPUTh8LSmwh8IULZ/3uPahwLB2XgCag
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
// SIG // a/15n8G9bW1qyVJzEw16UM0xghojMIIaHwIBATCBlTB+
// SIG // MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
// SIG // bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
// SIG // cm9zb2Z0IENvcnBvcmF0aW9uMSgwJgYDVQQDEx9NaWNy
// SIG // b3NvZnQgQ29kZSBTaWduaW5nIFBDQSAyMDExAhMzAAAE
// SIG // BGx0Bv9XKydyAAAAAAQEMA0GCWCGSAFlAwQCAQUAoIGu
// SIG // MBkGCSqGSIb3DQEJAzEMBgorBgEEAYI3AgEEMBwGCisG
// SIG // AQQBgjcCAQsxDjAMBgorBgEEAYI3AgEVMC8GCSqGSIb3
// SIG // DQEJBDEiBCCTKGeFUYhT/pQ0VZ6d+3uGAZYsvfZHXhUo
// SIG // IkCNL+RGHjBCBgorBgEEAYI3AgEMMTQwMqAUgBIATQBp
// SIG // AGMAcgBvAHMAbwBmAHShGoAYaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tMA0GCSqGSIb3DQEBAQUABIIBAF7HGehV
// SIG // nBJhU1pezFFo7EZUFosfYUUuCcgJpgYeXKSb7vsitbon
// SIG // 7NxD1n9jmKd9y2W1swZwxqLgZa2WFQlEmgm+XTdEI8jf
// SIG // GJyVZujYIniEncDFe42Benjp8jPZ7fhi1CLjoEtS7jXg
// SIG // dnZB4+Cj99dVzXSaYYi8QrGCOyuvoLTIEI4OwLK9B72w
// SIG // WizaB0og8VQUD8y4JEtZQycr20wJWXJSzhxRbFuE8+JA
// SIG // l9wzdK6BrbhNjN2FTVERPNjAbBIfESFoNyzvTjFppP/4
// SIG // cPvsP2ggwv/BJlg5GOeNs7cyqT4WOk0+yu9900OqmU03
// SIG // p4opnv0Fz2W8ezPynHY+mE3yinOhghetMIIXqQYKKwYB
// SIG // BAGCNwMDATGCF5kwgheVBgkqhkiG9w0BBwKggheGMIIX
// SIG // ggIBAzEPMA0GCWCGSAFlAwQCAQUAMIIBWgYLKoZIhvcN
// SIG // AQkQAQSgggFJBIIBRTCCAUECAQEGCisGAQQBhFkKAwEw
// SIG // MTANBglghkgBZQMEAgEFAAQgI1JKCZX40BiSN/5KwK7m
// SIG // n3c6rT7ce0oWa4flYXac/UICBmftTx9U5hgTMjAyNTA0
// SIG // MTYwMTA0NTAuNTA5WjAEgAIB9KCB2aSB1jCB0zELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0
// SIG // IElyZWxhbmQgT3BlcmF0aW9ucyBMaW1pdGVkMScwJQYD
// SIG // VQQLEx5uU2hpZWxkIFRTUyBFU046NjUxQS0wNUUwLUQ5
// SIG // NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1w
// SIG // IFNlcnZpY2WgghH7MIIHKDCCBRCgAwIBAgITMwAAAfWZ
// SIG // CZS88cZQjAABAAAB9TANBgkqhkiG9w0BAQsFADB8MQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDAeFw0yNDA3MjUx
// SIG // ODMxMDFaFw0yNTEwMjIxODMxMDFaMIHTMQswCQYDVQQG
// SIG // EwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
// SIG // BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENv
// SIG // cnBvcmF0aW9uMS0wKwYDVQQLEyRNaWNyb3NvZnQgSXJl
// SIG // bGFuZCBPcGVyYXRpb25zIExpbWl0ZWQxJzAlBgNVBAsT
// SIG // Hm5TaGllbGQgVFNTIEVTTjo2NTFBLTA1RTAtRDk0NzEl
// SIG // MCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2Vy
// SIG // dmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoC
// SIG // ggIBAMzvdHBUE1nf1j/OCE+yTCFtX0C+tbHX4JoZX09J
// SIG // 72BG9pL5DRdO92cI73rklqLd/Oy4xNEwohvd3uiNB8yB
// SIG // UAZ28Rj/1jwVIqxau1hOUQLLoTX2FC/jyG/YyatwsFsS
// SIG // An8Obf6U8iDh4yr6NZUDk1mcqYq/6bGcBBO8trlgD22S
// SIG // Uxaynp+Ue98dh28cuHltQ3Jl48ptsBVr9dLAR+NGoyX3
// SIG // vjpMHE3aGK2NypKTf0UEo3snCtG4Y6NAhmCGGvmTAGqN
// SIG // EjUf0dSdWOrC5IgiTt2kK20tUs+5fv6iYMvH8hGTDQ+T
// SIG // LOwtLBGjr6AR4lkqUzOL3NMQywpnOjxr9NwrVrtiosqq
// SIG // y/AQAdRGMjkoSNyE+/WqwyA6y/nXvdRX45kmwWOY/h70
// SIG // tJd3V5Iz9x6J/G++JVsIpBdK8xKxdJ95IVQLrMe0ptaB
// SIG // hvtOoc/VwMt1qLvk+knuqGuSw4kID031kf4/RTZPCbtO
// SIG // qEn04enNN1dLpZWtCMMvh81JflpmMRS1ND4ml7JoLnTc
// SIG // Fap+dc6/gYt1zyfOcFrsuhhk+5wQ5lzc0zZMyvfAwUI0
// SIG // zmm0F1GfPOGG/QxTXIoJnlU2JMlF2eobHHfDcquOQNw9
// SIG // 25Pp157KICtWe82Y+l2xn7e8YDmL73lOqdPn67YWxezF
// SIG // 7/ouanA/R3xZjquFWB3r1XrGG+j9AgMBAAGjggFJMIIB
// SIG // RTAdBgNVHQ4EFgQUVeB8W/VKNKBw8CWSXttosXtgdQEw
// SIG // HwYDVR0jBBgwFoAUn6cVXQBeYl2D9OXSZacbUzUZ6XIw
// SIG // XwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIw
// SIG // VGltZS1TdGFtcCUyMFBDQSUyMDIwMTAoMSkuY3JsMGwG
// SIG // CCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9N
// SIG // aWNyb3NvZnQlMjBUaW1lLVN0YW1wJTIwUENBJTIwMjAx
// SIG // MCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNVHSUBAf8E
// SIG // DDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4AwDQYJ
// SIG // KoZIhvcNAQELBQADggIBAHMMZlT2gPcR337qJtEzkqdo
// SIG // bKbn9RtHB1vylxwLoZ6VvP0r5auY/WiiP/PxunxiEDK9
// SIG // M5aWrvI8vNyOM3JRnSY5eUtNksQ5VCmsLVr4H+4nWtOj
// SIG // 4I3kDNXl+C7reG2z309BRKe+xu+oYcrF8UyTR7+cvn8E
// SIG // 4VHoonJYoWcKnGTKWuOpvqFeooE1OiNBJ53qLTKhbNEN
// SIG // 8x4FVa+Fl45xtgXJ5IqeNnncoP/Yl3M6kwaxJL089FJZ
// SIG // baRRmkJy86vjaPFRIKtFBu1tRC2RoZpsRZhwAcE0+rDy
// SIG // RVevA3y6AtIgfUG2/VWfJr201eSbSEgZJU7lQJRJM14v
// SIG // SyIzZsfpJ3QXyj/HcRv8W0V6bUA0A2grEuqIC5MC4B+s
// SIG // 0rPrpfVpsyNBfMyJm4Z2YVM4iB4XhaOB/maKIz2HIEyu
// SIG // v925Emzmm5kBX/eQfAenuVql20ubPTnTHVJVtYEyNa+b
// SIG // vlgMB9ihu3cZ3qE23/42Jd01LT+wB6cnJNnNJ7p/0NAs
// SIG // nKWvUFB/w8tNZOrUKJjVxo4r4NvwRnIGSdB8PAuilXpR
// SIG // Cd9cS6BNtZvfjRIEigkaBRNS5Jmt9UsiGsp23WBG/LDp
// SIG // WcpzHZvMj5XQ8LheeLyYhAK463AzV3ugaG2VIk1kir79
// SIG // QyWnUdUlAjvzndtRoFPoWarvnSoIygGHXkyL4vUdq7S2
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
// SIG // f9lwY1NNje6CbaUFEMFxBmoQtB1VM1izoXBm8qGCA1Yw
// SIG // ggI+AgEBMIIBAaGB2aSB1jCB0zELMAkGA1UEBhMCVVMx
// SIG // EzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1Jl
// SIG // ZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3Jh
// SIG // dGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0IElyZWxhbmQg
// SIG // T3BlcmF0aW9ucyBMaW1pdGVkMScwJQYDVQQLEx5uU2hp
// SIG // ZWxkIFRTUyBFU046NjUxQS0wNUUwLUQ5NDcxJTAjBgNV
// SIG // BAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Wi
// SIG // IwoBATAHBgUrDgMCGgMVACbACruPDW0eWEYN1kgUAso8
// SIG // 3ZL2oIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEm
// SIG // MCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENB
// SIG // IDIwMTAwDQYJKoZIhvcNAQELBQACBQDrqPBCMCIYDzIw
// SIG // MjUwNDE1MTQ0ODM0WhgPMjAyNTA0MTYxNDQ4MzRaMHQw
// SIG // OgYKKwYBBAGEWQoEATEsMCowCgIFAOuo8EICAQAwBwIB
// SIG // AAICL6cwBwIBAAICE0UwCgIFAOuqQcICAQAwNgYKKwYB
// SIG // BAGEWQoEAjEoMCYwDAYKKwYBBAGEWQoDAqAKMAgCAQAC
// SIG // AwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsFAAOC
// SIG // AQEAKwZuGsv8Vb1HfytnQRvdK9rj7zRKcW/RYYTpwUJ+
// SIG // zFN353fpKjJJZBbywEKG1ZTRX4x1dq9hzFUcy2I28Fg6
// SIG // gAaS5xwd5Mtv4tx0g52IZSmiCjwlUjQfUznUB4WA0jrm
// SIG // p/cXxsp/5xRLpYP82CFJZKZa91QqnfDZv/lsKGlnYQl+
// SIG // LkN2vQ43kR76xLoywN/2T6d8JomebStqD6yzGAhpk4R8
// SIG // a6VWQrI7yrHPhwAoqbIx+UIFYBKfj5hqV4LQbYxPoo6I
// SIG // uSCD8V6lkXXLIbGKyk47eoZjQenH+iKHdOBcziKO9r9a
// SIG // GkORtiLxsQokQsI5GrBkze2wagbsl8aPTbB0ATGCBA0w
// SIG // ggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQI
// SIG // EwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4w
// SIG // HAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAk
// SIG // BgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAy
// SIG // MDEwAhMzAAAB9ZkJlLzxxlCMAAEAAAH1MA0GCWCGSAFl
// SIG // AwQCAQUAoIIBSjAaBgkqhkiG9w0BCQMxDQYLKoZIhvcN
// SIG // AQkQAQQwLwYJKoZIhvcNAQkEMSIEINxKLAZCx1P8IvaL
// SIG // mQsPMjnemAlpCkOr/rKZTzcG3eCQMIH6BgsqhkiG9w0B
// SIG // CRACLzGB6jCB5zCB5DCBvQQgwdby0hcIdPSEruJHRL+P
// SIG // 7YPXkdWJPMOce4+Rk4amjzUwgZgwgYCkfjB8MQswCQYD
// SIG // VQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4G
// SIG // A1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0
// SIG // IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQg
// SIG // VGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAfWZCZS88cZQ
// SIG // jAABAAAB9TAiBCBTvTnPmezxI6kXltrwnl8+NXq+MUoN
// SIG // 3kyb/zq9pECeRTANBgkqhkiG9w0BAQsFAASCAgBbVaY1
// SIG // s72okb3gkOCDhWgOCF+niWumqn6gZuffm6j1rBrL7tns
// SIG // +Rp/Axa0ghi+RF9NTsYOKGs5sCHGHBxLcG8cEPlmXW9J
// SIG // AWXP7R4IWVLkm8PdLFcAbLdFGNIWEtWiYksAOINJFj/H
// SIG // hap3EFVaYBWIDHH4wDTVMJ8dnqZDGVKM4OO9stDzXrDE
// SIG // CE4HcM6ijYUtqb9BQYHvKiqYT0Nu4jeqIiL/Nv6975La
// SIG // 166HHcbxSyFr5HaxBfkZ+ymM6W8pBOtv+yJ0SMUYNXNZ
// SIG // K9MQLIFu3nD/pFTcuoYTvOjGyjPEYUGWVP2OSlwSlixI
// SIG // fHpsKhbqQ9qXyui35DIIC6HQ7LGrDIlobR13UMtNsqwa
// SIG // CXSwr/UvYuI1/VJkzEarS/b24tARM5GcqTtq4vW972BA
// SIG // ahDcKyJJHCAwiYA96w6QiS4rVnmi3Gdx+kDSu7znneBQ
// SIG // 0UJMGtDGjyzXlYuHzL00tvjzWdOLmFkre4kpTWREyQ7q
// SIG // aeXWnHuGhEvKlVSCySDNF9H+/FQv99Szx+lGl3x1t64I
// SIG // U5bfWE3ejmSa3Mok1wWO482JJBPzjqTi2rgDRYczFzJH
// SIG // 2pRAHFWzOFQ8+AIrC2h+RnALCOVEdG6PORoAY7IzJZpc
// SIG // GPT4nib0FT00YdkYHYmRuhN920/oHGGPmb4xnYYjxzI7
// SIG // LViAwpYUXIhYZM4r1A==
// SIG // End signature block
