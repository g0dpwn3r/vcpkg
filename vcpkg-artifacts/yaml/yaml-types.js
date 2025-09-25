"use strict";
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Yaml = exports.YAMLScalar = exports.YAMLSequence = exports.YAMLDictionary = void 0;
const yaml_1 = require("yaml");
const error_kind_1 = require("../interfaces/error-kind");
const checks_1 = require("../util/checks");
class YAMLDictionary extends yaml_1.YAMLMap {
}
exports.YAMLDictionary = YAMLDictionary;
class YAMLSequence extends yaml_1.YAMLSeq {
}
exports.YAMLSequence = YAMLSequence;
class YAMLScalar extends yaml_1.Scalar {
}
exports.YAMLScalar = YAMLScalar;
class Yaml {
    parent;
    key;
    constructor(/** @internal */ node, parent, key) {
        this.parent = parent;
        this.key = key;
        this.node = node;
        if (!(this.constructor).create) {
            throw new Error(`class ${this.constructor.name} is missing implementation for create`);
        }
    }
    get fullName() {
        return !this.node ? '' : this.parent ? this.key ? `${this.parent.fullName}.${this.key}` : this.parent.fullName : this.key || '$';
    }
    /** returns the current node as a JSON string */
    toString() {
        return this.node?.toJSON() ?? '';
    }
    get keys() {
        return this.exists() && (0, yaml_1.isMap)(this.node) ? this.node.items.map(each => this.asString(each.key)) : [];
    }
    /**
     * Coercion function to string
     *
     * This will pass the coercion up to the parent if it exists
     * (or otherwise overridden in the subclass)
     *
     * Which allows for value overriding
     */
    asString(value) {
        if (this.parent) {
            return this.parent.asString(value);
        }
        return value === undefined ? undefined : ((0, yaml_1.isScalar)(value) ? value.value : value).toString();
    }
    /**
     * Coercion function to number
     *
     * This will pass the coercion up to the parent if it exists
     * (or otherwise overridden in the subclass)
     *
     * Which allows for value overriding
     */
    asNumber(value) {
        if (this.parent) {
            return this.parent.asNumber(value);
        }
        if ((0, yaml_1.isScalar)(value)) {
            value = value.value;
        }
        return typeof value === 'number' ? value : undefined;
    }
    /**
     * Coercion function to boolean
     *
     * This will pass the coercion up to the parent if it exists
     * (or otherwise overridden in the subclass)
     *
     * Which allows for value overriding
     */
    asBoolean(value) {
        if (this.parent) {
            return this.parent.asBoolean(value);
        }
        if ((0, yaml_1.isScalar)(value)) {
            value = value.value;
        }
        return typeof value === 'boolean' ? value : undefined;
    }
    /**
     * Coercion function to any primitive
     *
     * This will pass the coercion up to the parent if it exists
     * (or otherwise overridden in the subclass)
     *
     * Which allows for value overriding
     */
    asPrimitive(value) {
        if (this.parent) {
            return this.parent.asPrimitive(value);
        }
        if ((0, yaml_1.isScalar)(value)) {
            value = value.value;
        }
        switch (typeof value) {
            case 'boolean':
            case 'number':
            case 'string':
                return value;
        }
        return undefined;
    }
    get root() {
        return this.parent ? this.parent.root : this;
    }
    createNode() {
        return this.constructor.create();
    }
    /**@internal*/ static create() {
        throw new Error('creator not Not implemented on base class.');
    }
    _node;
    get node() {
        if (this._node) {
            return this._node;
        }
        if (this.key && this.parent && (0, yaml_1.isMap)(this.parent?.node)) {
            this._node = this.parent.node.get(this.key, true);
        }
        return this._node;
    }
    set node(n) {
        this._node = n;
    }
    sourcePosition(key) {
        if (!this.node) {
            return undefined;
        }
        if (key !== undefined) {
            if (((0, yaml_1.isMap)(this.node) || (0, yaml_1.isSeq)(this.node))) {
                const node = this.node.get(key, true);
                if (node) {
                    return node.range || undefined;
                }
                return undefined;
            }
            if ((0, yaml_1.isScalar)(this.node)) {
                throw new Error('Scalar does not have a key to get a source position');
            }
        }
        return this.node?.range || undefined;
    }
    /** will dispose of this object if it is empty (or forced) */
    dispose(force = false, deleteFromParent = true) {
        if ((this.empty || force) && this.node) {
            if (deleteFromParent) {
                this.parent?.deleteChild(this);
            }
            this.node = undefined;
        }
    }
    /** if this node has any data, this should return false */
    get empty() {
        if ((0, yaml_1.isCollection)(this.node)) {
            return !(this.node?.items.length);
        }
        else if ((0, yaml_1.isScalar)(this.node)) {
            return !(0, checks_1.isNullish)(this.node.value);
        }
        return false;
    }
    /** @internal */ exists() {
        if (this.node) {
            return true;
        }
        // well, if we're lazy and haven't instantiated it yet, check if it's created.
        if (this.key && this.parent && (0, yaml_1.isMap)(this.parent.node)) {
            this.node = this.parent.node.get(this.key);
            if (this.node) {
                return true;
            }
        }
        return false;
    }
    /** @internal */ assert(recreateIfDisposed = false, node = this.node) {
        if (this.node && this.node === node) {
            return; // quick and fast
        }
        if (recreateIfDisposed) {
            // ensure that this node is the node we're supposed to be.
            this.node = node;
            if (this.parent) {
                // ensure that the parent is not disposed
                this.parent.assert(true);
                if ((0, yaml_1.isMap)(this.parent.node)) {
                    if (this.key) {
                        // we have a parent, and the key, we can add the node.
                        // let's just check if there is one first
                        this.node = this.node || this.parent.node.get(this.key) || this.createNode();
                        this.parent.node.set(this.key, this.node);
                        return;
                    }
                    // the parent is a map, but we don't have a key, so we can't add the node.
                    throw new Error('Parent is a map, but we don\'t have a key');
                }
                if ((0, yaml_1.isSeq)(this.parent.node)) {
                    this.node = this.node || this.parent.node.get(this.key) || this.createNode();
                    this.parent.node.add(this.node);
                    return;
                }
                throw new Error('YAML parent is not a container.');
            }
        }
        throw new Error('YAML node is undefined');
    }
    deleteChild(child) {
        if (!child.node) {
            // this child is already disposed
            return;
        }
        this.assert();
        const node = this.node;
        if ((0, yaml_1.isMap)(node)) {
            if (child.key) {
                node.delete(child.key);
                child.dispose(true, false);
                this.dispose(); // clean up if this is empty
                return;
            }
        }
        if ((0, yaml_1.isSeq)(node)) {
            // child is in some kind of collection.
            // we should be able to find the child's index and remove it.
            const items = node.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i] === child.node) {
                    node.delete(i);
                    child.dispose(true, false);
                    this.dispose(); // clean up if this is empty
                    return;
                }
            }
            // if we get here, we didn't find the child.
            // but, it's not in the object, so we're good I guess
            throw new Error('Child Node not found trying to delete');
            // return;
        }
        throw new Error('this node does not have children.');
    }
    *validate() {
        // shh.
    }
    *validateChildKeys(keys) {
        if ((0, yaml_1.isMap)(this.node)) {
            for (const key of this.keys) {
                if (keys.indexOf(key) === -1) {
                    yield {
                        message: `Unexpected '${key}' found in ${this.fullName}`,
                        range: this.sourcePosition(key),
                        category: error_kind_1.ErrorKind.InvalidChild,
                    };
                }
            }
        }
    }
    *validateIsObject() {
        if (this.node && !(0, yaml_1.isMap)(this.node)) {
            yield {
                message: `'${this.fullName}' is not an object`,
                range: this,
                category: error_kind_1.ErrorKind.IncorrectType
            };
        }
    }
    *validateIsSequence() {
        if (this.node && !(0, yaml_1.isSeq)(this.node)) {
            yield {
                message: `'${this.fullName}' is not an object`,
                range: this,
                category: error_kind_1.ErrorKind.IncorrectType
            };
        }
    }
    *validateIsSequenceOrPrimitive() {
        if (this.node && (!(0, yaml_1.isSeq)(this.node) && !(0, yaml_1.isScalar)(this.node))) {
            yield {
                message: `'${this.fullName}' is not a sequence or value`,
                range: this,
                category: error_kind_1.ErrorKind.IncorrectType
            };
        }
    }
    *validateIsObjectOrPrimitive() {
        if (this.node && (!(0, yaml_1.isMap)(this.node) && !(0, yaml_1.isScalar)(this.node))) {
            yield {
                message: `'${this.fullName}' is not an object or value`,
                range: this,
                category: error_kind_1.ErrorKind.IncorrectType
            };
        }
    }
    *validateChild(child, kind) {
        if (this.node && (0, yaml_1.isMap)(this.node)) {
            if (this.node.has(child)) {
                const c = this.node.get(child, true);
                if (!(0, yaml_1.isScalar)(c) || typeof c.value !== kind) {
                    yield {
                        message: `'${this.fullName}.${child}' is not a ${kind} value`,
                        range: c.range,
                        category: error_kind_1.ErrorKind.IncorrectType
                    };
                }
            }
        }
    }
}
exports.Yaml = Yaml;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieWFtbC10eXBlcy5qcyIsInNvdXJjZVJvb3QiOiJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vbWljcm9zb2Z0L3ZjcGtnLXRvb2wvbWFpbi92Y3BrZy1hcnRpZmFjdHMvIiwic291cmNlcyI6WyJ5YW1sL3lhbWwtdHlwZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHVDQUF1QztBQUN2QyxrQ0FBa0M7OztBQUVsQywrQkFBc0Y7QUFDdEYseURBQXFEO0FBRXJELDJDQUEyQztBQUUzQyxNQUFhLGNBQWUsU0FBUSxjQUFvQjtDQUFJO0FBQTVELHdDQUE0RDtBQUM1RCxNQUFhLFlBQWEsU0FBUSxjQUFZO0NBQUk7QUFBbEQsb0NBQWtEO0FBQ2xELE1BQWEsVUFBVyxTQUFRLGFBQVc7Q0FBSTtBQUEvQyxnQ0FBK0M7QUFLL0MsTUFBdUMsSUFBSTtJQUNlO0lBQStCO0lBQXZGLFlBQVksZ0JBQWdCLENBQUMsSUFBZSxFQUFZLE1BQW1CLEVBQVksR0FBWTtRQUEzQyxXQUFNLEdBQU4sTUFBTSxDQUFhO1FBQVksUUFBRyxHQUFILEdBQUcsQ0FBUztRQUNqRyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLENBQXlCLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBRSxDQUFDLE1BQU0sRUFBRTtZQUN2RCxNQUFNLElBQUksS0FBSyxDQUFDLFNBQVMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLHVDQUF1QyxDQUFDLENBQUM7U0FDeEY7SUFDSCxDQUFDO0lBRUQsSUFBSSxRQUFRO1FBQ1YsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxD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
// SIG // Begin signature block
// SIG // MIIoQQYJKoZIhvcNAQcCoIIoMjCCKC4CAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // h8bWcruBEJhlu6+dUorHMSn/LRCR8uRNHwmgx+r+iDOg
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
// SIG // DQEJBDEiBCCEQEUMoy9gEVBAf7TbNVuhFRnBkHO4UERE
// SIG // NKJuN4flSTBCBgorBgEEAYI3AgEMMTQwMqAUgBIATQBp
// SIG // AGMAcgBvAHMAbwBmAHShGoAYaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tMA0GCSqGSIb3DQEBAQUABIIBAGi3c1dq
// SIG // oTUgsdJpMhu2+i0hYXCFLaAOO8WAwFuv0HqCmdzpg1DP
// SIG // 5vCJCNj3RaC2Vv56JnNG1Rb2I9EeJ5UvvbslZrLappE7
// SIG // QyjZrqJyI3+YlxDRoacdjKYOPRtUMaDLs0WsO/HqP9ga
// SIG // PMNI+TOhY5wxIIWgejLuTAVe7stxA4iXUuP2ybHvfW7p
// SIG // eAC0q23NlrBcUBvfGqJvslbLloEgK6TTUcumQotr0Eqh
// SIG // IXP/FvV5p89oYuQnRD1HPyw+pKYAdPcsNwy0Q+y8uT+s
// SIG // CmAs2QKOMeMQrRAtlVqmgg45bgp/aQe44V7TOOHPb0Px
// SIG // ooV6PENTAF3Ct3FRP8XUtLrvPqehghetMIIXqQYKKwYB
// SIG // BAGCNwMDATGCF5kwgheVBgkqhkiG9w0BBwKggheGMIIX
// SIG // ggIBAzEPMA0GCWCGSAFlAwQCAQUAMIIBWgYLKoZIhvcN
// SIG // AQkQAQSgggFJBIIBRTCCAUECAQEGCisGAQQBhFkKAwEw
// SIG // MTANBglghkgBZQMEAgEFAAQgol2Fbq/Jx55uJ3Q9R1Jt
// SIG // iSrpDgjNmg+tfkoNCv/YIaECBmftLW/4cBgTMjAyNTA0
// SIG // MTYwMTA0NTkuNDMzWjAEgAIB9KCB2aSB1jCB0zELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0
// SIG // IElyZWxhbmQgT3BlcmF0aW9ucyBMaW1pdGVkMScwJQYD
// SIG // VQQLEx5uU2hpZWxkIFRTUyBFU046NDMxQS0wNUUwLUQ5
// SIG // NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1w
// SIG // IFNlcnZpY2WgghH7MIIHKDCCBRCgAwIBAgITMwAAAfr7
// SIG // O0TTdzPG0wABAAAB+jANBgkqhkiG9w0BAQsFADB8MQsw
// SIG // CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQ
// SIG // MA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDAeFw0yNDA3MjUx
// SIG // ODMxMTFaFw0yNTEwMjIxODMxMTFaMIHTMQswCQYDVQQG
// SIG // EwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
// SIG // BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENv
// SIG // cnBvcmF0aW9uMS0wKwYDVQQLEyRNaWNyb3NvZnQgSXJl
// SIG // bGFuZCBPcGVyYXRpb25zIExpbWl0ZWQxJzAlBgNVBAsT
// SIG // Hm5TaGllbGQgVFNTIEVTTjo0MzFBLTA1RTAtRDk0NzEl
// SIG // MCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2Vy
// SIG // dmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoC
// SIG // ggIBAMoWVQTNz2XAXxKQH+3yCIcoMGFVT+uFEnmW0pUU
// SIG // d6byXm72tC0Ag1uOcjq7acCKRsgxl/hGwmx4UuU3eCdG
// SIG // JXPN87SxG20A+zOpKkdF4/p/NnBrHv0JzB9FkWS58IIC
// SIG // XXp6UOlHIjOJzGGb3UI8mwOKnoznvWNO9yZV791SG3ZE
// SIG // B9iRsk/KAfy7Lzy/5AJyeOaECKe0see0T0P9Duqmsidk
// SIG // ia8HIwPGrjHQJ2SjosRZc6KKIe0ssnCOwRDR06ZFSq0V
// SIG // eWHpUb1jU4NaR+BAtijtm8bATdt27THk72RYnhiK/g/J
// SIG // n9ZUELNB7f7TDlXWodeLe2JPsZeT+E8N8XwBoB7L7Gur
// SIG // oK8cJik019ZKlx+VwncN01XigmseiVfsoDOYtTa6CSsA
// SIG // QltdT8ItM/5IvdGXjul3xBPZgpyZu+kHMYt7Z1v2P92b
// SIG // pikOl/4lSCaOy5NGf6QE0cACDasHb86XbV9oTiYm+Bkf
// SIG // IrNm6SpLNOBrq38Hlj5/c+o2OxgQvo7PKUsBnsK338IA
// SIG // GzSpvNmQxb6gRkEFScCB0l6Y5Evht/XsmDhtq3CCwSA5
// SIG // c1MzBRSWzYebQ79xnidxCrwuLzUgMbRn2hv5kISuN2I3
// SIG // r7Ae9i6LlO/K8bTYbjF0s2h6uXxYht83LGB2muPsPmJj
// SIG // K4UxMw+EgIrId+QY6Fz9T9QreFWtAgMBAAGjggFJMIIB
// SIG // RTAdBgNVHQ4EFgQUY4xymy+VlepHdOiqHEB6YSvVP78w
// SIG // HwYDVR0jBBgwFoAUn6cVXQBeYl2D9OXSZacbUzUZ6XIw
// SIG // XwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIw
// SIG // VGltZS1TdGFtcCUyMFBDQSUyMDIwMTAoMSkuY3JsMGwG
// SIG // CCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0cDov
// SIG // L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9N
// SIG // aWNyb3NvZnQlMjBUaW1lLVN0YW1wJTIwUENBJTIwMjAx
// SIG // MCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNVHSUBAf8E
// SIG // DDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4AwDQYJ
// SIG // KoZIhvcNAQELBQADggIBALhWwqKxa76HRvmTSR92Pjc+
// SIG // UKVMrUFTmzsmBa4HBq8aujFGuMi5sTeMVnS9ZMoGluQT
// SIG // md8QZT2O1abn+W+Xmlz+6kautcXjq193+uJBoklqEYvR
// SIG // CWsCVgsyX1EEU4Qy+M8SNqWHNcJz6e0OveWx6sGdNnmj
// SIG // gbnYfyHxJBntDn4+iEt6MmbCT9cmrXJuJAaiB+nW9fsH
// SIG // jOKuOjYQHwH9O9MxehfiKVB8obTG0IOfkB3zrsgc67eu
// SIG // wojCUinCd5zFcnzZZ7+sr7bWMyyt8EvtEMCVImy2CTCO
// SIG // hRnErkcSpaukYzoSvS90Do4dFQjNdaxzNdWZjdHriW2w
// SIG // QlX0BLnzizZBvPDBQlDRNdEkmzPzoPwm05KNDOcG1b0C
// SIG // egqiyo7R0qHqABj3nl9uH+XD2Mk3CpWzOi6FHTtj+SUn
// SIG // SObNSRfzp+i4lE+dGnaUbLWWo22BHl/ze0b0m5J9HYw9
// SIG // wb09jn91n/YCHmkCB279Sdjvz+UDj0IlaPPtACpujNEy
// SIG // jnbooYSsQLf+mMpNexb90SHY0+sIi9qkSBLIDiad3yC8
// SIG // OJkET7t7KUX2pEqEHuTdHuB1hX/FltmS9PnPN0M4d1bR
// SIG // DyOmNntgTv3loU2GyGx6amA3wLQGLWmCHXvO2cplxtzD
// SIG // tsFI4S/R70kM46KrqvjqFJr3wVHAdnuS+kAhzuqkzu1q
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
// SIG // ZWxkIFRTUyBFU046NDMxQS0wNUUwLUQ5NDcxJTAjBgNV
// SIG // BAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Wi
// SIG // IwoBATAHBgUrDgMCGgMVAPeGfm1CZ/pysAbyCOrINDcu
// SIG // 2jw2oIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNV
// SIG // BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
// SIG // HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEm
// SIG // MCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENB
// SIG // IDIwMTAwDQYJKoZIhvcNAQELBQACBQDrqXdQMCIYDzIw
// SIG // MjUwNDE2MDAyNDQ4WhgPMjAyNTA0MTcwMDI0NDhaMHQw
// SIG // OgYKKwYBBAGEWQoEATEsMCowCgIFAOupd1ACAQAwBwIB
// SIG // AAICHD4wBwIBAAICEj0wCgIFAOuqyNACAQAwNgYKKwYB
// SIG // BAGEWQoEAjEoMCYwDAYKKwYBBAGEWQoDAqAKMAgCAQAC
// SIG // AwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsFAAOC
// SIG // AQEAgUL2B9ZbUkjWZKq2gXIYZnZ4kDRcPOzIrAuEQgOo
// SIG // 5SACzlD9hv1uw7TPWyeNaV9jHv8z9yqxlvKjFYTMNap3
// SIG // T7yg3amn8AePjsUUGRH2/J/4+5D4C7EFEZ7dMIN5iVP7
// SIG // A2ZVFvfGyneAvhdS3NVTKYGqfkUFRpXyYuYLNLREzLUw
// SIG // HKakIQWDmgBG1lWu/W/PIenbELCaCM1b36t1/dE3QL51
// SIG // aP8CrX1y5PQiLGwuch9PAQzHtCTxaqvJZc7rC5DSqRNG
// SIG // GLzyJrCVLP/PRniuEB8T6BaaRUgf+qkroxAoga7jBaRK
// SIG // 2xTVz8/8Gb+YQW1IO8gv2X6J7ZAvi+Df6YATujGCBA0w
// SIG // ggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQI
// SIG // EwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4w
// SIG // HAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAk
// SIG // BgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAy
// SIG // MDEwAhMzAAAB+vs7RNN3M8bTAAEAAAH6MA0GCWCGSAFl
// SIG // AwQCAQUAoIIBSjAaBgkqhkiG9w0BCQMxDQYLKoZIhvcN
// SIG // AQkQAQQwLwYJKoZIhvcNAQkEMSIEIPUCqYc0n/FCKT/n
// SIG // HHnBcRqYCJ1+3lwka5vV8XCmvCRVMIH6BgsqhkiG9w0B
// SIG // CRACLzGB6jCB5zCB5DCBvQQgffJ/LcmvPgdo41P3aSUS
// SIG // MB8Bx6XKOaIDUrWKHG5DnlYwgZgwgYCkfjB8MQswCQYD
// SIG // VQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4G
// SIG // A1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0
// SIG // IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQg
// SIG // VGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAfr7O0TTdzPG
// SIG // 0wABAAAB+jAiBCDEgyxvkCkDebbf1MZakACVouMx0bkq
// SIG // Vsk8r/Xu77zPRjANBgkqhkiG9w0BAQsFAASCAgDFrcDQ
// SIG // 1SpJQLn+WtrVojWvrg8w7a3nOo/NzpTNL8991J8Vphph
// SIG // Y9xXIF1tCG0jxYfJMw2mlOckYYOh57EBPc3sG+Zb1iON
// SIG // nuoGz46VjoxYTtN8fOlH/TG78MucM4l4F1jcMkKGxX5q
// SIG // mF6xnVMTjEf16ljI1+ALmQr1hD9cWJJjafeFVuqZ0euT
// SIG // uRe04IuuLlT7CluJo8ZUVR7dFNwcvzKaeRfA0S0sPkyy
// SIG // ZN0DxhnPLEm8xvqf7yIpRNHcBkbENZAyLQBJD5NQpwyo
// SIG // M43eAemcG0mPUvPjZUPeIhZ8mDATg/GULI6akSj9QTYy
// SIG // M1wKELQk2RWnLKmkLMLHU0LxDGtzeqMi55166aHxCV4n
// SIG // fr6H0VN0Ev95me42QlEXM52zmemMwH9q+Vw/G+1gpYbz
// SIG // WG1KGuyjVI7zRUvCHkq+SEUrtIOyRlwyNfBErxuiFRUa
// SIG // KxVOAlXIOSt3fO/dDwpXGXTijp13CLAD3oALQ6ySNWzP
// SIG // 8zSk5MRx7NdFKG7iFd84KXuvVJyYhUTUlEz0LWNhCvPl
// SIG // sS+jAr+tO+e3Oc3wMlKe2qpFR5+NpGK90Gdv17JdfV6T
// SIG // rDf0OgL902ryw/UHKv3AljS1REgiskLtyemEVvDRcKo3
// SIG // X+H9kiMSqs2iNcaOX/scDYPeS7hQ2/s2fAvuVyriYyCv
// SIG // G//VhtOq1TQjf6AXKg==
// SIG // End signature block
