"use strict";
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.intersect = void 0;
/**
 * Creates an intersection object from two source objects.
 *
 * Typescript nicely supports defining intersection types (ie, Foo & Bar )
 * But if you have two seperate *instances*, and you want to use them as the implementation
 * of that intersection, the language doesn't solve that for you.
 *
 * This function creates a strongly typed proxy type around the two objects,
 * and returns members for the intersection of them.
 *
 * This works well for properties and member functions the same.
 *
 * Members in the primary object will take precedence over members in the secondary object if names conflict.
 *
 * This can also be used to "add" arbitrary members to an existing type (without mutating the original object)
 *
 * @example
 * const combined = intersect( new Foo(), { test: () => { console.debug('testing'); } });
 * combined.test(); // writes out 'testing' to console
 *
 * @param primary primary object - members from this will have precedence.
 * @param secondary secondary object - members from this will be used if primary does not have a member
 */
// eslint-disable-next-line @typescript-eslint/ban-types
function intersect(primary, secondary, filters = ['constructor']) {
    // eslint-disable-next-line keyword-spacing
    return new Proxy({ primary, secondary }, {
        // member get proxy handler
        get(target, property, receiver) {
            // check for properties on the objects first
            const propertyName = property.toString();
            // provide custom JON impl.
            if (propertyName === 'toJSON') {
                return () => {
                    const allKeys = this.ownKeys();
                    const o = {};
                    for (const i of allKeys) {
                        const v = this.get(target, i);
                        if (typeof v !== 'function') {
                            o[i] = v;
                        }
                    }
                    return o;
                };
            }
            const pv = target.primary[property];
            const sv = target.secondary[property];
            if (pv !== undefined) {
                if (typeof pv === 'function') {
                    return pv.bind(primary);
                }
                return pv;
            }
            if (sv !== undefined) {
                if (typeof sv === 'function') {
                    return sv.bind(secondary);
                }
                return sv;
            }
            return undefined;
        },
        // member set proxy handler
        set(target, property, value) {
            const propertyName = property.toString();
            if (Object.getOwnPropertyNames(target.primary).indexOf(propertyName) > -1) {
                return target.primary[property] = value;
            }
            if (Object.getOwnPropertyNames(target.secondary).indexOf(propertyName) > -1) {
                return target.secondary[property] = value;
            }
            return undefined;
        },
        ownKeys(target) {
            return [...new Set([
                    ...Object.getOwnPropertyNames(Object.getPrototypeOf(primary)),
                    ...Object.getOwnPropertyNames(primary),
                    ...Object.getOwnPropertyNames(Object.getPrototypeOf(secondary)),
                    ...Object.getOwnPropertyNames(secondary)
                ].filter(each => filters.indexOf(each) === -1))];
        }
    });
}
exports.intersect = intersect;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW50ZXJzZWN0LmpzIiwic291cmNlUm9vdCI6Imh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9taWNyb3NvZnQvdmNwa2ctdG9vbC9tYWluL3ZjcGtnLWFydGlmYWN0cy8iLCJzb3VyY2VzIjpbInV0aWwvaW50ZXJzZWN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSx1Q0FBdUM7QUFDdkMsa0NBQWtDOzs7QUFFbEM7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FzQkc7QUFDSCx3REFBd0Q7QUFDeEQsU0FBZ0IsU0FBUyxDQUFzQyxPQUFVLEVBQUUsU0FBYSxFQUFFLE9BQU8sR0FBRyxDQUFDLGFBQWEsQ0FBQztJQUNqSCwyQ0FBMkM7SUFDM0MsT0FBb0IsSUFBSSxLQUFLLENBQUMsRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLEVBQU87UUFDekQsMkJBQTJCO1FBQzNCLEdBQUcsQ0FBQyxNQUFxQyxFQUFFLFFBQXlCLEVBQUUsUUFBYTtZQUNqRiw0Q0FBNEM7WUFDNUMsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBRXpDLDJCQUEyQjtZQUMzQixJQUFJLFlBQVksS0FBSyxRQUFRLEVBQUU7Z0JBQzdCLE9BQU8sR0FBRyxFQUFFO29CQUNWLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztvQkFDL0IsTUFBTSxDQUFDLEdBQVEsRUFBRSxDQUFDO29CQUNsQixLQUFLLE1BQU0sQ0FBQyxJQUFJLE9BQU8sRUFBRTt3QkFDdkIsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7d0JBQzlCLElBQUksT0FBTyxDQUFDLEtBQUssVUFBVSxFQUFFOzRCQUMzQixDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO3lCQUNWO3FCQUNGO29CQUNELE9BQU8sQ0FBQyxDQUFDO2dCQUNYLENBQUMsQ0FBQzthQUNIO1lBRUQsTUFBTSxFQUFFLEdBQVMsTUFBTSxDQUFDLE9BQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMzQyxNQUFNLEVBQUUsR0FBUyxNQUFNLENBQUMsU0FBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBRTdDLElBQUksRUFBRSxLQUFLLFNBQVMsRUFBRTtnQkFDcEIsSUFBSSxPQUFPLEVBQUUsS0FBSyxVQUFVLEVBQUU7b0JBQzVCLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztpQkFDekI7Z0JBQ0QsT0FBTyxFQUFFLENBQUM7YUFDWDtZQUVELElBQUksRUFBRSxLQUFLLFNBQVMsRUFBRTtnQkFDcEIsSUFBSSxPQUFPLEVBQUUsS0FBSyxVQUFVLEVBQUU7b0JBQzVCLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztpQkFDM0I7Z0JBQ0QsT0FBTyxFQUFFLENBQUM7YUFDWDtZQUVELE9BQU8sU0FBUyxDQUFDO1FBQ25CLENBQUM7UUFFRCwyQkFBMkI7UUFDM0IsR0FBRyxDQUFDLE1BQXFDLEVBQUUsUUFBeUIsRUFBRSxLQUFVO1lBQzlFLE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUV6QyxJQUFJLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFO2dCQUN6RSxPQUFhLE1BQU0sQ0FBQyxPQUFRLENBQUMsUUFBUSxDQUFDLEdBQUcsS0FBSyxDQUFDO2FBQ2hEO1lBQ0QsSUFBSSxNQUFNLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtnQkFDM0UsT0FBYSxNQUFNLENBQUMsU0FBVSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEtBQUssQ0FBQzthQUNsRDtZQUNELE9BQU8sU0FBUyxDQUFDO1FBQ25CLENBQUM7UUFDRCxPQUFPLENBQUMsTUFBcUM7WUFDM0MsT0FBTyxDQUFDLEdBQUcsSUFBSSxHQUFHLENBQUM7b0JBQ2pCLEdBQUcsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQzdELEdBQUcsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQztvQkFDdEMsR0FBRyxNQUFNLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDL0QsR0FBRyxNQUFNLENBQUMsbUJBQW1CLENBQUMsU0FBUyxDQUFDO2lCQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3RixDQUFDO0tBRUYsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQWhFRCw4QkFnRUMifQ==
// SIG // Begin signature block
// SIG // MIIoQgYJKoZIhvcNAQcCoIIoMzCCKC8CAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // MhZAJiEyWZ4cbym6Zkikm9fPV6MC6L/hu7v2kOSKqIag
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
// SIG // a/15n8G9bW1qyVJzEw16UM0xghokMIIaIAIBATCBlTB+
// SIG // MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
// SIG // bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
// SIG // cm9zb2Z0IENvcnBvcmF0aW9uMSgwJgYDVQQDEx9NaWNy
// SIG // b3NvZnQgQ29kZSBTaWduaW5nIFBDQSAyMDExAhMzAAAE
// SIG // BGx0Bv9XKydyAAAAAAQEMA0GCWCGSAFlAwQCAQUAoIGu
// SIG // MBkGCSqGSIb3DQEJAzEMBgorBgEEAYI3AgEEMBwGCisG
// SIG // AQQBgjcCAQsxDjAMBgorBgEEAYI3AgEVMC8GCSqGSIb3
// SIG // DQEJBDEiBCBPyM4wZ1pfi6E7x6u7id/AuAW7kUCxFgYQ
// SIG // 4Jy31ygYDTBCBgorBgEEAYI3AgEMMTQwMqAUgBIATQBp
// SIG // AGMAcgBvAHMAbwBmAHShGoAYaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tMA0GCSqGSIb3DQEBAQUABIIBAFrtK2KI
// SIG // FviMbhTa0J3iqh7teNCynlfCvvkPldQFWakOW6vFrIuV
// SIG // CQDTLEWbPXBr+Joa9ZRWZIgePhQSDFV5KjQMQCrLNmkm
// SIG // IcP0luTS2g8D3DGnTi484qvYB6etjD/wLPELG4KygM9R
// SIG // Jvj0TYKNLmbo965ZmNjFU2VUdSpoBKocH2PkQl0AK9TP
// SIG // LVtFCRjSoEw8JGRP2hWx5WH9zGsvWDiyjXySz6j6cEIq
// SIG // NzRJ23qxCkuEXk6ywLjBeh5JJQOvY6mgKRrWj7gQ4tsB
// SIG // /DZ3r3a/kGgauHqouD4X8tOpVFtbwlx+DCYbE/4fCvYQ
// SIG // P6UcrngD9Xdk8scVTf+j8iNpm2ChgheuMIIXqgYKKwYB
// SIG // BAGCNwMDATGCF5owgheWBgkqhkiG9w0BBwKggheHMIIX
// SIG // gwIBAzEPMA0GCWCGSAFlAwQCAQUAMIIBWAYLKoZIhvcN
// SIG // AQkQAQSgggFHBIIBQzCCAT8CAQEGCisGAQQBhFkKAwEw
// SIG // MTANBglghkgBZQMEAgEFAAQgOmfDvDPa+LiawWSGA3Ci
// SIG // VUrs8FkkA2e4l0CR0okgPK4CBmftK7cNEhgRMjAyNTA0
// SIG // MTYwMTA1MDUuMlowBIACAfSggdmkgdYwgdMxCzAJBgNV
// SIG // BAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYD
// SIG // VQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQg
// SIG // Q29ycG9yYXRpb24xLTArBgNVBAsTJE1pY3Jvc29mdCBJ
// SIG // cmVsYW5kIE9wZXJhdGlvbnMgTGltaXRlZDEnMCUGA1UE
// SIG // CxMeblNoaWVsZCBUU1MgRVNOOjM2MDUtMDVFMC1EOTQ3
// SIG // MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBT
// SIG // ZXJ2aWNloIIR/jCCBygwggUQoAMCAQICEzMAAAH3WCB1
// SIG // BMr7wvQAAQAAAfcwDQYJKoZIhvcNAQELBQAwfDELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0
// SIG // IFRpbWUtU3RhbXAgUENBIDIwMTAwHhcNMjQwNzI1MTgz
// SIG // MTA2WhcNMjUxMDIyMTgzMTA2WjCB0zELMAkGA1UEBhMC
// SIG // VVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcT
// SIG // B1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jw
// SIG // b3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0IElyZWxh
// SIG // bmQgT3BlcmF0aW9ucyBMaW1pdGVkMScwJQYDVQQLEx5u
// SIG // U2hpZWxkIFRTUyBFU046MzYwNS0wNUUwLUQ5NDcxJTAj
// SIG // BgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZp
// SIG // Y2UwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoIC
// SIG // AQDQ50dME2ibr+5cpoQo/2s8hORPpDEXXW2PMHQ2TVvI
// SIG // Ok+sVMeFreHHBJ1NyvxjRreToRCXCrLpE7PjZ7RHl4Nb
// SIG // 50KhBqmKkMgVQ5ineg26rBf/F6kBMSRjXszJcXHqtBbY
// SIG // 1xZQlbdCjYC4nQc61uVKki1Bk8aYecaqS38MHjkXDGTp
// SIG // WhK/E1xAqEoROS7Ou3xToNFxxCbUV2GY8qAPOBx8M8zm
// SIG // j4afNuIy7rLTr0DgQeYsyaR5xKRW8GZxnxWfMUdMOQYt
// SIG // 2mcNXkVeNU5sCBtIzRyephIZ9GntUYcFGrKixy9HhtxD
// SIG // 4JX2kONsnpLmtmfW4DyFGGPT0ezfcdF6+3ihYBVgYi2A
// SIG // Swb4GsJhumBYwMQhWcCA9kSI8BojzAEZ6YTh94SS7PtM
// SIG // DCCREFxTMuBDi68+pEPUD4mS3br6kOpZhKfQwDyPTNpx
// SIG // CT2r8C9yI9cP0i3Z7P6aoTOAVFGwkYu1x/0eSy8rwmx3
// SIG // ojnMVKGWqLlunN/Vjg06I06HlDBbWki8DmKuVqXuoWGQ
// SIG // B555mqainz643FlfEUJAbdHezmldbz0WIKH2uZetWo4L
// SIG // CBxcUglABCSWUqwj5Qmoar2uZEAEnPmUcpMViYXBwznY
// SIG // pZaM3HfPqh3DPaH6zFrF7BOh70aq0PHf9pT7Ko1FwHzD
// SIG // S1JdR/7KU3i6TnEcSkunH5k02wIDAQABo4IBSTCCAUUw
// SIG // HQYDVR0OBBYEFN9GpDM/eb09la4t/Wnz+Z4V+SaYMB8G
// SIG // A1UdIwQYMBaAFJ+nFV0AXmJdg/Tl0mWnG1M1GelyMF8G
// SIG // A1UdHwRYMFYwVKBSoFCGTmh0dHA6Ly93d3cubWljcm9z
// SIG // b2Z0LmNvbS9wa2lvcHMvY3JsL01pY3Jvc29mdCUyMFRp
// SIG // bWUtU3RhbXAlMjBQQ0ElMjAyMDEwKDEpLmNybDBsBggr
// SIG // BgEFBQcBAQRgMF4wXAYIKwYBBQUHMAKGUGh0dHA6Ly93
// SIG // d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY2VydHMvTWlj
// SIG // cm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUyMDIwMTAo
// SIG // MSkuY3J0MAwGA1UdEwEB/wQCMAAwFgYDVR0lAQH/BAww
// SIG // CgYIKwYBBQUHAwgwDgYDVR0PAQH/BAQDAgeAMA0GCSqG
// SIG // SIb3DQEBCwUAA4ICAQA3RqNp8gt4vpJAgwgwBczVB3rF
// SIG // qhyLaY6ulHy8pbLJOwvdvzcDtcYuIBtDFOuqde9VZZ42
// SIG // y3lhAPyxo75ROA4sl1N19QAOEtegr5GXCN+d2KYglP0w
// SIG // f21RhcvMlcqFkzT2i4/A2yufxg4sil0CLlM/I3wKXXU4
// SIG // ZlKU/2vwme+iZbTQCgng+X2uWDQbmVxCScBeodr2dB1a
// SIG // nVnFeo137QmwqaVHy1wA1ffcKUz02doKUkTEtAeIp4dR
// SIG // Ra2rIsyXrlNbrBEzteUXtj49OcLx241afi4ueD4439nf
// SIG // 0Y7qoGPsgRnGirijdq8SH1trjdRTpODNVloGbxVoDTBL
// SIG // BR7+mqlM5gVY3rZcveCX8kLanN8g/E/rpd9EsjFp+MFV
// SIG // ebwpUOfZwwv0i9ErTaz3jVjn5FHiBIA6EuJBDoDTdU1G
// SIG // 6n6ykxrST5dM8CL7ZowfnFrVmNv8ry71/0zTlTT9tQwl
// SIG // ckM/77KxakltVEOIcbuzNpxr6vceJQ+NAnJCXY2I5xhM
// SIG // ZX8NwussIErbMbnTcUZvTg3kp/XReADAVpeWh3kH14qH
// SIG // 3k+dcrHYs0GAvAbzlqeWGEbHEFDmYWwkaQGfQ9k+0DNn
// SIG // J+v3qrHOmnakf0MklyMoIOsyZnOJdrOlrlVU3foI7WQN
// SIG // TgAGRJhNc4zxGYle5CbuZQXdtaaP6GMAlvinPqFPlTCC
// SIG // B3EwggVZoAMCAQICEzMAAAAVxedrngKbSZkAAAAAABUw
// SIG // DQYJKoZIhvcNAQELBQAwgYgxCzAJBgNVBAYTAlVTMRMw
// SIG // EQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRt
// SIG // b25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRp
// SIG // b24xMjAwBgNVBAMTKU1pY3Jvc29mdCBSb290IENlcnRp
// SIG // ZmljYXRlIEF1dGhvcml0eSAyMDEwMB4XDTIxMDkzMDE4
// SIG // MjIyNVoXDTMwMDkzMDE4MzIyNVowfDELMAkGA1UEBhMC
// SIG // VVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcT
// SIG // B1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jw
// SIG // b3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUt
// SIG // U3RhbXAgUENBIDIwMTAwggIiMA0GCSqGSIb3DQEBAQUA
// SIG // A4ICDwAwggIKAoICAQDk4aZM57RyIQt5osvXJHm9DtWC
// SIG // 0/3unAcH0qlsTnXIyjVX9gF/bErg4r25PhdgM/9cT8dm
// SIG // 95VTcVrifkpa/rg2Z4VGIwy1jRPPdzLAEBjoYH1qUoNE
// SIG // t6aORmsHFPPFdvWGUNzBRMhxXFExN6AKOG6N7dcP2CZT
// SIG // fDlhAnrEqv1yaa8dq6z2Nr41JmTamDu6GnszrYBbfowQ
// SIG // HJ1S/rboYiXcag/PXfT+jlPP1uyFVk3v3byNpOORj7I5
// SIG // LFGc6XBpDco2LXCOMcg1KL3jtIckw+DJj361VI/c+gVV
// SIG // mG1oO5pGve2krnopN6zL64NF50ZuyjLVwIYwXE8s4mKy
// SIG // zbnijYjklqwBSru+cakXW2dg3viSkR4dPf0gz3N9QZpG
// SIG // dc3EXzTdEonW/aUgfX782Z5F37ZyL9t9X4C626p+Nuw2
// SIG // TPYrbqgSUei/BQOj0XOmTTd0lBw0gg/wEPK3Rxjtp+iZ
// SIG // fD9M269ewvPV2HM9Q07BMzlMjgK8QmguEOqEUUbi0b1q
// SIG // GFphAXPKZ6Je1yh2AuIzGHLXpyDwwvoSCtdjbwzJNmSL
// SIG // W6CmgyFdXzB0kZSU2LlQ+QuJYfM2BjUYhEfb3BvR/bLU
// SIG // HMVr9lxSUV0S2yW6r1AFemzFER1y7435UsSFF5PAPBXb
// SIG // GjfHCBUYP3irRbb1Hode2o+eFnJpxq57t7c+auIurQID
// SIG // AQABo4IB3TCCAdkwEgYJKwYBBAGCNxUBBAUCAwEAATAj
// SIG // BgkrBgEEAYI3FQIEFgQUKqdS/mTEmr6CkTxGNSnPEP8v
// SIG // BO4wHQYDVR0OBBYEFJ+nFV0AXmJdg/Tl0mWnG1M1Gely
// SIG // MFwGA1UdIARVMFMwUQYMKwYBBAGCN0yDfQEBMEEwPwYI
// SIG // KwYBBQUHAgEWM2h0dHA6Ly93d3cubWljcm9zb2Z0LmNv
// SIG // bS9wa2lvcHMvRG9jcy9SZXBvc2l0b3J5Lmh0bTATBgNV
// SIG // HSUEDDAKBggrBgEFBQcDCDAZBgkrBgEEAYI3FAIEDB4K
// SIG // AFMAdQBiAEMAQTALBgNVHQ8EBAMCAYYwDwYDVR0TAQH/
// SIG // BAUwAwEB/zAfBgNVHSMEGDAWgBTV9lbLj+iiXGJo0T2U
// SIG // kFvXzpoYxDBWBgNVHR8ETzBNMEugSaBHhkVodHRwOi8v
// SIG // Y3JsLm1pY3Jvc29mdC5jb20vcGtpL2NybC9wcm9kdWN0
// SIG // cy9NaWNSb29DZXJBdXRfMjAxMC0wNi0yMy5jcmwwWgYI
// SIG // KwYBBQUHAQEETjBMMEoGCCsGAQUFBzAChj5odHRwOi8v
// SIG // d3d3Lm1pY3Jvc29mdC5jb20vcGtpL2NlcnRzL01pY1Jv
// SIG // b0NlckF1dF8yMDEwLTA2LTIzLmNydDANBgkqhkiG9w0B
// SIG // AQsFAAOCAgEAnVV9/Cqt4SwfZwExJFvhnnJL/Klv6lwU
// SIG // tj5OR2R4sQaTlz0xM7U518JxNj/aZGx80HU5bbsPMeTC
// SIG // j/ts0aGUGCLu6WZnOlNN3Zi6th542DYunKmCVgADsAW+
// SIG // iehp4LoJ7nvfam++Kctu2D9IdQHZGN5tggz1bSNU5HhT
// SIG // dSRXud2f8449xvNo32X2pFaq95W2KFUn0CS9QKC/GbYS
// SIG // EhFdPSfgQJY4rPf5KYnDvBewVIVCs/wMnosZiefwC2qB
// SIG // woEZQhlSdYo2wh3DYXMuLGt7bj8sCXgU6ZGyqVvfSaN0
// SIG // DLzskYDSPeZKPmY7T7uG+jIa2Zb0j/aRAfbOxnT99kxy
// SIG // bxCrdTDFNLB62FD+CljdQDzHVG2dY3RILLFORy3BFARx
// SIG // v2T5JL5zbcqOCb2zAVdJVGTZc9d/HltEAY5aGZFrDZ+k
// SIG // KNxnGSgkujhLmm77IVRrakURR6nxt67I6IleT53S0Ex2
// SIG // tVdUCbFpAUR+fKFhbHP+CrvsQWY9af3LwUFJfn6Tvsv4
// SIG // O+S3Fb+0zj6lMVGEvL8CwYKiexcdFYmNcP7ntdAoGokL
// SIG // jzbaukz5m/8K6TT4JDVnK+ANuOaMmdbhIurwJ0I9JZTm
// SIG // dHRbatGePu1+oDEzfbzL6Xu/OHBE0ZDxyKs6ijoIYn/Z
// SIG // cGNTTY3ugm2lBRDBcQZqELQdVTNYs6FwZvKhggNZMIIC
// SIG // QQIBATCCAQGhgdmkgdYwgdMxCzAJBgNVBAYTAlVTMRMw
// SIG // EQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRt
// SIG // b25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRp
// SIG // b24xLTArBgNVBAsTJE1pY3Jvc29mdCBJcmVsYW5kIE9w
// SIG // ZXJhdGlvbnMgTGltaXRlZDEnMCUGA1UECxMeblNoaWVs
// SIG // ZCBUU1MgRVNOOjM2MDUtMDVFMC1EOTQ3MSUwIwYDVQQD
// SIG // ExxNaWNyb3NvZnQgVGltZS1TdGFtcCBTZXJ2aWNloiMK
// SIG // AQEwBwYFKw4DAhoDFQBvbwoMb/Fds0GOYzv+erDduCsQ
// SIG // 5qCBgzCBgKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQI
// SIG // EwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4w
// SIG // HAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAk
// SIG // BgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAy
// SIG // MDEwMA0GCSqGSIb3DQEBCwUAAgUA66l1lzAiGA8yMDI1
// SIG // MDQxNjAwMTcyN1oYDzIwMjUwNDE3MDAxNzI3WjB3MD0G
// SIG // CisGAQQBhFkKBAExLzAtMAoCBQDrqXWXAgEAMAoCAQAC
// SIG // AgjKAgH/MAcCAQACAhKbMAoCBQDrqscXAgEAMDYGCisG
// SIG // AQQBhFkKBAIxKDAmMAwGCisGAQQBhFkKAwKgCjAIAgEA
// SIG // AgMHoSChCjAIAgEAAgMBhqAwDQYJKoZIhvcNAQELBQAD
// SIG // ggEBACj1m8beA9n6aKjeUj8dCMGl3ghF8/S7rVPCv8W0
// SIG // xaUp0CZ8s0HV+Mq5x9srQ0ZFCCPsu/NAMFTSM2v8JoZL
// SIG // 1o99TXWLoQJUqSCGmgt+w8OiH+zJsJi+Ky/WkDNARrXl
// SIG // KimmfsaD8fNGTKDq8eBGTDUm8wqroSLyv2uxpusa6a65
// SIG // 8DPAX8kYRjrI6qVIfofagjL4uZiqVJUmIpvIqzitnrBu
// SIG // Ybd0dPREL71DO5DIw2y24PA+w6pa9u4yNcVGKr4LB2Ok
// SIG // /kSXEQifVM/MwafSqwJjA1oQ7cT7jqitqwLhd4qRn+fx
// SIG // 9BsV+R4volLFI50W3DXDalSgPmwo0dFzjoiHX68xggQN
// SIG // MIIECQIBATCBkzB8MQswCQYDVQQGEwJVUzETMBEGA1UE
// SIG // CBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEe
// SIG // MBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYw
// SIG // JAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0Eg
// SIG // MjAxMAITMwAAAfdYIHUEyvvC9AABAAAB9zANBglghkgB
// SIG // ZQMEAgEFAKCCAUowGgYJKoZIhvcNAQkDMQ0GCyqGSIb3
// SIG // DQEJEAEEMC8GCSqGSIb3DQEJBDEiBCA18d6qYIPjxrbz
// SIG // HdEzMWNThPiS36zaQZ5fHyP412CRwTCB+gYLKoZIhvcN
// SIG // AQkQAi8xgeowgecwgeQwgb0EICHamNprdxrR5xi6G7rS
// SIG // 5gc/8gqc9t51tVAnlKggflniMIGYMIGApH4wfDELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0
// SIG // IFRpbWUtU3RhbXAgUENBIDIwMTACEzMAAAH3WCB1BMr7
// SIG // wvQAAQAAAfcwIgQgY8ismajQd6+X62HNhWUCPCwGJL0E
// SIG // 3mTqd+7N8Cku7uYwDQYJKoZIhvcNAQELBQAEggIAIh/3
// SIG // tAWnEQBHsl4Z1HHezmfkq7VlU1m5vvKqQGvbG7bWqJPZ
// SIG // orknhO2kpIbbsRxo/jmVCBKSGnehMGRSJLI2jFlXBrGi
// SIG // Jk/C50Z1GtUu9VegdAgOmT3ko5/H1BBTrZMEmxYtN+Zr
// SIG // B8f2j54NevyVuPWmg5IqX1//xOIC8OarA+ZC6a4EjdR1
// SIG // M8xxPvircmYiWOyQgMgFrvoDZwzC8VsrivV3DvSxKVDg
// SIG // v2MDJP58rElKFAVCbaoA6JRGDOuWQ+01aGnk1LyjBdXc
// SIG // Vx1MijpBVUtdpjsUGt/3Ns9q+tJ8hWCJTU4aeiaP0A8o
// SIG // 1LYVzz/NMd4TF7PtD3DHk/TOX87IBx355hRQqeidD8RH
// SIG // EMQwSAmr4Lm0urkqhHAZ8B+8o/BIQiI2TQoStQvy6RuP
// SIG // QwjlPRjDmMu+R7Fq+OvheomaEdGGINyjMQkuwH8znEbA
// SIG // 3cTCRw30o8u5qLHDniK4Wvnq1T6e1kZOD9+6gqaXpYmm
// SIG // lzx92BP1shA9eDOnZ9kAxxbH6AvZ5FITQlvXupVBpT7m
// SIG // 5wz4Q4re48P3+iprmk8d2ya5yd/7ysIujH0Y+CBQsKXv
// SIG // 0zM0mIMZ1sB9ho3cOt6GD90kO9v5dcMJ/nWenu9S6Pw1
// SIG // biC8jLf/WZvo4G26ipXIEqJ8qQxbnb0R3vd8PZA90r0H
// SIG // ck3YurdMwosbySejJN8=
// SIG // End signature block
