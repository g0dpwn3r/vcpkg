"use strict";
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexSchema = exports.SemverKey = exports.IdentityKey = exports.StringKey = exports.Index = void 0;
const semver_1 = require("semver");
const sorted_btree_1 = require("sorted-btree");
const i18n_1 = require("../i18n");
const checks_1 = require("../util/checks");
const linq_1 = require("../util/linq");
/**
 * An Index is the means to search a registry
 *
 * @param TGraph The type of object to create an index for
 * @param TIndexSchema the custom index schema (layout).
 */
class Index {
    indexConstructor;
    /** @internal */
    indexSchema;
    /** @internal */
    indexOfTargets = new Array();
    /**
     * Creates an index for fast searching.
     *
     * @param indexConstructor the class for the custom index.
     */
    constructor(indexConstructor) {
        this.indexConstructor = indexConstructor;
        this.indexSchema = new indexConstructor(this);
    }
    reset() {
        this.indexSchema = new this.indexConstructor(this);
    }
    /**
     * Serializes the index to a javascript object graph that can be persisted.
     */
    serialize() {
        return {
            items: this.indexOfTargets,
            indexes: this.indexSchema.serialize()
        };
    }
    /**
     * Deserializes an object graph to the expected indexes.
     *
     * @param content the object graph to deserialize.
     */
    deserialize(content) {
        this.indexOfTargets = content.items;
        this.indexSchema.deserialize(content.indexes);
    }
    /**
     * Returns a clone of the index that can be searched, which narrows the list of
     */
    get where() {
        // clone the index so that the consumer can filter on it.
        const index = new Index(this.indexConstructor);
        index.indexOfTargets = this.indexOfTargets;
        for (const [key, impl] of this.indexSchema.mapOfKeyObjects.entries()) {
            index.indexSchema.mapOfKeyObjects.get(key).cloneKey(impl);
        }
        return index.indexSchema;
    }
    /** inserts an object into the index */
    insert(content, target) {
        const n = this.indexOfTargets.push(target) - 1;
        const start = process.uptime() * 1000;
        for (const indexKey of this.indexSchema.mapOfKeyObjects.values()) {
            indexKey.insert(content, n);
        }
    }
    doneInsertion() {
        for (const indexKey of this.indexSchema.mapOfKeyObjects.values()) {
            indexKey.doneInsertion();
        }
    }
}
exports.Index = Index;
/**
 * A Key is a means to creating a searchable, sortable index
 */
class Key {
    accessor;
    nestedKeys = new Array();
    values = new sorted_btree_1.default(undefined, this.compare);
    words = new sorted_btree_1.default();
    indexSchema;
    identity;
    alternativeIdentities;
    /** persists the key to an object graph */
    serialize() {
        const result = {
            keys: {},
            words: {},
        };
        for (const each of this.values.entries()) {
            result.keys[each[0]] = [...each[1]];
        }
        for (const each of this.words.entries()) {
            result.words[each[0]] = [...each[1]];
        }
        return result;
    }
    /** deserializes an object graph back into this key */
    deserialize(content) {
        for (const [key, ids] of (0, linq_1.entries)(content.keys)) {
            this.values.set(this.coerce(key), new Set(ids));
        }
        for (const [key, ids] of (0, linq_1.entries)(content.words)) {
            this.words.set(key, new Set(ids));
        }
    }
    /** @internal */
    cloneKey(from) {
        this.values = from.values.greedyClone();
        this.words = from.words.greedyClone();
    }
    /** adds key value to this Key */
    addKey(each, n) {
        let set = this.values.get(each);
        if (!set) {
            set = new Set();
            this.values.set(each, set);
        }
        set.add(n);
    }
    /** adds a 'word' value to this key  */
    addWord(each, n) {
        const words = each.toString().split(/(\W+)/g);
        for (let word = 0; word < words.length; word += 2) {
            for (let i = word; i < words.length; i += 2) {
                const s = words.slice(word, i + 1).join('');
                if (s && s.indexOf(' ') === -1) {
                    let set = this.words.get(s);
                    if (!set) {
                        set = new Set();
                        this.words.set(s, set);
                    }
                    set.add(n);
                }
            }
        }
    }
    /** processes an object to generate key/word values for it. */
    insert(graph, n) {
        let value = this.accessor(graph);
        if (value) {
            value = (Array.isArray(value) ? value
                : typeof value === 'string' ? [value]
                    : (0, checks_1.isIterable)(value) ? [...value] : [value]);
            this.insertKey(graph, n, value);
        }
    }
    /** insert the key/word values and process any children */
    insertKey(graph, n, value) {
        if ((0, checks_1.isIterable)(value)) {
            for (const each of value) {
                this.addKey(each, n);
                this.addWord(each, n);
                if (this.nestedKeys) {
                    for (const child of this.nestedKeys) {
                        const v = child.accessor(graph, each.toString());
                        if (v) {
                            child.insertKey(graph, n, v);
                        }
                    }
                }
            }
        }
        else {
            this.addKey(value, n);
            this.addWord(value, n);
        }
    }
    /** construct a Key */
    constructor(indexSchema, accessor, protoIdentity) {
        this.accessor = accessor;
        this.indexSchema = indexSchema;
        if (typeof protoIdentity === 'string') {
            this.identity = protoIdentity;
            this.alternativeIdentities = [protoIdentity];
        }
        else {
            this.identity = protoIdentity[0];
            this.alternativeIdentities = protoIdentity;
        }
        this.indexSchema.mapOfKeyObjects.set(this.identity, this);
    }
    /** word search */
    contains(value) {
        if (value !== undefined && value !== '') {
            const matches = this.words.get(value.toString());
            this.indexSchema.filter(matches || []);
        }
        return this.indexSchema;
    }
    /** exact match search */
    equals(value) {
        if (value !== undefined && value !== '') {
            const matches = this.values.get(this.coerce(value));
            this.indexSchema.filter(matches || []);
        }
        return this.indexSchema;
    }
    /** metadata value is greater than search */
    greaterThan(value) {
        const max = this.values.maxKey();
        const set = new Set();
        if (max && value !== undefined && value !== '') {
            this.values.forRange(this.coerce(value), max, true, (k, v) => {
                for (const n of v) {
                    set.add(n);
                }
            });
        }
        this.indexSchema.filter(set.values());
        return this.indexSchema;
    }
    /** metadata value is less than search */
    lessThan(value) {
        const min = this.values.minKey();
        const set = new Set();
        if (min && value !== undefined && value !== '') {
            value = this.coerce(value);
            this.values.forRange(min, this.coerce(value), false, (k, v) => {
                for (const n of v) {
                    set.add(n);
                }
            });
        }
        this.indexSchema.filter(set.values());
        return this.indexSchema;
    }
    /** regex search -- WARNING: slower */
    match(regex) {
        // This could be faster if we stored a reverse lookup
        // array that had the id for each key, but .. I don't
        // think the perf will suffer much doing it this way.
        const set = new Set();
        for (const node of this.values.entries()) {
            for (const id of node[1]) {
                if (!this.indexSchema.selectedElements || this.indexSchema.selectedElements.has(id)) {
                    // it's currently in the keep list.
                    if (regex.match(node.toString())) {
                        set.add(id);
                    }
                }
            }
        }
        this.indexSchema.filter(set.values());
        return this.indexSchema;
    }
    /** substring match -- slower */
    startsWith(value) {
        // ok, I'm being lazy here. I can add a check to see if we're past
        // the point where this could be a match, but I don't know if I'll
        // even need this enough to keep it.
        const set = new Set();
        for (const node of this.values.entries()) {
            for (const id of node[1]) {
                if (!this.indexSchema.selectedElements || this.indexSchema.selectedElements.has(id)) {
                    // it's currently in the keep list.
                    if (node[0].toString().startsWith(value.toString())) {
                        set.add(id);
                    }
                }
            }
        }
        this.indexSchema.filter(set.values());
        return this.indexSchema;
    }
    /** substring match -- slower */
    endsWith(value) {
        // Same thing here, but I'd have to do a reversal of all the strings.
        const set = new Set();
        for (const node of this.values.entries()) {
            for (const id of node[1]) {
                if (!this.indexSchema.selectedElements || this.indexSchema.selectedElements.has(id)) {
                    // it's currently in the keep list.
                    if (node[0].toString().endsWith(value.toString())) {
                        set.add(id);
                    }
                }
            }
        }
        this.indexSchema.filter(set.values());
        return this.indexSchema;
    }
    doneInsertion() {
        // nothing normally
    }
}
/** An  key for string values. */
class StringKey extends Key {
    compare(a, b) {
        if (a && b) {
            return a.localeCompare(b);
        }
        if (a) {
            return 1;
        }
        if (b) {
            return -1;
        }
        return 0;
    }
    /** impl: transform value into comparable key */
    coerce(value) {
        return value;
    }
}
exports.StringKey = StringKey;
function shortName(value, n) {
    const v = value.split('/');
    let p = v.length - n;
    if (p < 0) {
        p = 0;
    }
    return v.slice(p).join('/');
}
class IdentityKey extends StringKey {
    identities = new sorted_btree_1.default(undefined, this.compare);
    idShortName = new Map();
    doneInsertion() {
        // go thru each of the values, find short name for each.
        const ids = new linq_1.ManyMap();
        for (const idAndIndexNumber of this.values.entries()) {
            ids.push(shortName(idAndIndexNumber[0], 1), idAndIndexNumber);
        }
        let n = 1;
        while (ids.size > 0) {
            n++;
            for (const [snKey, artifacts] of [...ids.entries()]) {
                // remove it from the list.
                ids.delete(snKey);
                if (artifacts.length === 1) {
                    // keep this one, it's unique
                    this.identities.set(snKey, artifacts[0][1]);
                    this.idShortName.set(artifacts[0][0], snKey);
                }
                else {
                    for (const each of artifacts) {
                        ids.push(shortName(each[0], n), each);
                    }
                }
            }
        }
    }
    /** @internal */
    cloneKey(from) {
        super.cloneKey(from);
        this.identities = from.identities.greedyClone();
        this.idShortName = new Map(from.idShortName);
    }
    getShortNameOf(id) {
        return this.idShortName.get(id);
    }
    nameOrShortNameIs(value) {
        if (value !== undefined && value !== '') {
            const matches = this.identities.get(value);
            if (matches) {
                this.indexSchema.filter(matches);
            }
            else {
                return this.equals(value);
            }
        }
        return this.indexSchema;
    }
    /** deserializes an object graph back into this key */
    deserialize(content) {
        super.deserialize(content);
        this.doneInsertion();
    }
}
exports.IdentityKey = IdentityKey;
/** An key for string values. Does not support 'word' searches */
class SemverKey extends Key {
    compare(a, b) {
        return a.compare(b);
    }
    coerce(value) {
        if (typeof value === 'string') {
            return new semver_1.SemVer(value);
        }
        return value;
    }
    addWord(each, n) {
        // no parts
    }
    rangeMatch(value) {
        // This could be faster if we stored a reverse lookup
        // array that had the id for each key, but .. I don't
        // think the perf will suffer much doing it this way.
        const set = new Set();
        const range = new semver_1.Range(value);
        for (const node of this.values.entries()) {
            for (const id of node[1]) {
                if (!this.indexSchema.selectedElements || this.indexSchema.selectedElements.has(id)) {
                    // it's currently in the keep list.
                    if (range.test(node[0])) {
                        set.add(id);
                    }
                }
            }
        }
        this.indexSchema.filter(set.values());
        return this.indexSchema;
    }
    serialize() {
        const result = super.serialize();
        result.words = undefined;
        return result;
    }
}
exports.SemverKey = SemverKey;
/**
 * Base class for a custom IndexSchema
 *
 * @param TGraph - the object kind to be indexing
 * @param TSelf - the child class that is being constructed.
 */
class IndexSchema {
    index;
    /** the collection of keys in this IndexSchema */
    mapOfKeyObjects = new Map();
    /**
     * the selected element ids.
     *
     * if this is `undefined`, the whole set is currently selected
     */
    selectedElements;
    /**
     * filter the selected elements down to an intersection of the {selectedelements} ∩ {idsToKeep}
     *
     * @param idsToKeep the element ids to intersect with.
     */
    filter(idsToKeep) {
        if (this.selectedElements) {
            const selected = new Set();
            for (const each of idsToKeep) {
                if (this.selectedElements.has(each)) {
                    selected.add(each);
                }
            }
            this.selectedElements = selected;
        }
        else {
            this.selectedElements = new Set(idsToKeep);
        }
    }
    /**
     * Serializes this IndexSchema to a persistable object graph.
     */
    serialize() {
        const result = {};
        for (const [key, impl] of this.mapOfKeyObjects.entries()) {
            result[key] = impl.serialize();
        }
        return result;
    }
    /**
     * Deserializes a persistable object graph into the IndexSchema.
     *
     * replaces any existing data in the IndexSchema.
     * @param content the persistable object graph.
     */
    deserialize(content) {
        for (const [key, impl] of this.mapOfKeyObjects.entries()) {
            let anyMatches = false;
            for (const maybeIdentity of impl.alternativeIdentities) {
                const maybeKey = content[maybeIdentity];
                if (maybeKey) {
                    impl.deserialize(maybeKey);
                    anyMatches = true;
                    break;
                }
            }
            if (!anyMatches) {
                throw new Error((0, i18n_1.i) `Failed to deserialize index ${key}`);
            }
        }
    }
    /**
     * returns the selected
     */
    get items() {
        return this.selectedElements ? [...this.selectedElements].map(each => this.index.indexOfTargets[each]) : this.index.indexOfTargets;
    }
    /** @internal */
    constructor(index) {
        this.index = index;
    }
}
exports.IndexSchema = IndexSchema;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXhlci5qcyIsInNvdXJjZVJvb3QiOiJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vbWljcm9zb2Z0L3ZjcGtnLXRvb2wvbWFpbi92Y3BrZy1hcnRpZmFjdHMvIiwic291cmNlcyI6WyJyZWdpc3RyaWVzL2luZGV4ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHVDQUF1QztBQUN2QyxrQ0FBa0M7OztBQUVsQyxtQ0FBdUM7QUFDdkMsK0NBQWlDO0FBQ2pDLGtDQUE0QjtBQUM1QiwyQ0FBNEM7QUFDNUMsdUNBQWdEO0FBU2hEOzs7OztHQUtHO0FBQ0gsTUFBYSxLQUFLO0lBV007SUFWdEIsZ0JBQWdCO0lBQ2hCLFdBQVcsQ0FBZTtJQUMxQixnQkFBZ0I7SUFDaEIsY0FBYyxHQUFHLElBQUksS0FBSyxFQUFVLENBQUM7SUFFckM7Ozs7T0FJRztJQUNILFlBQXNCLGdCQUEwRTtRQUExRSxxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQTBEO1FBQzlGLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRUQsS0FBSztRQUNILElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUztRQUNQLE9BQU87WUFDTCxLQUFLLEVBQUUsSUFBSSxDQUFDLGNBQWM7WUFDMUIsT0FBTyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxFQUFFO1NBQ3RDLENBQUM7SUFDSixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILFdBQVcsQ0FBQyxPQUFZO1FBQ3RCLElBQUksQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQztRQUNwQyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxLQUFLO1FBQ1AseURBQXlEO1FBQ3pELE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQy9DLEtBQUssQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQztRQUMzQyxLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDcEUsS0FBSyxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUM1RDtRQUNELE9BQU8sS0FBSyxDQUFDLFdBQVcsQ0FBQztJQUMzQixDQUFDO0lBRUQsdUNBQXVDO0lBQ3ZDLE1BQU0sQ0FBQyxPQUFlLEVBQUUsTUFBYztRQUNwQyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDL0MsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQztRQUN0QyxLQUFLLE1BQU0sUUFBUSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxFQUFFO1lBQ2hFLFFBQVEsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO1NBQzdCO0lBQ0gsQ0FBQztJQUVELGFBQWE7UUFDWCxLQUFLLE1BQU0sUUFBUSxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxFQUFFO1lBQ2hFLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQztTQUMxQjtJQUNILENBQUM7Q0FDRjtBQWxFRCxzQkFrRUM7QUFFRDs7R0FFRztBQUNILE1BQWUsR0FBRztJQThHbUQ7SUF0R3pELFVBQVUsR0FBRyxJQUFJLEtBQUssRUFBa0MsQ0FBQztJQUN6RCxNQUFNLEdBQUcsSUFBSSxzQkFBSyxDQUFvQixTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQy9ELEtBQUssR0FBRyxJQUFJLHNCQUFLLEVBQXVCLENBQUM7SUFDekMsV0FBVyxDQUFlO0lBQzNCLFFBQVEsQ0FBUztJQUNqQixxQkFBcUIsQ0FBZ0I7SUFFOUMsMENBQTBDO0lBQzFDLFNBQVM7UUFDUCxNQUFNLE1BQU0sR0FBUTtZQUNsQixJQUFJLEVBQUUsRUFBRTtZQUNSLEtBQUssRUFBRSxFQUFFO1NBQ1YsQ0FBQztRQUNGLEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUN4QyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNyQztRQUNELEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUN2QyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUN0QztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRCxzREFBc0Q7SUFDdEQsV0FBVyxDQUFDLE9BQVk7UUFDdEIsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLElBQUEsY0FBTyxFQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUM5QyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLElBQUksR0FBRyxDQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7U0FDdEQ7UUFDRCxLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLElBQUksSUFBQSxjQUFPLEVBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQy9DLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLEdBQUcsQ0FBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1NBQ3hDO0lBQ0gsQ0FBQztJQUVELGdCQUFnQjtJQUNoQixRQUFRLENBQUMsSUFBVTtRQUNqQixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDeEMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDO0lBQ3hDLENBQUM7SUFFRCxpQ0FBaUM7SUFDdkIsTUFBTSxDQUFDLElBQVUsRUFBRSxDQUFTO1FBQ3BDLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hDLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDUixHQUFHLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztZQUN4QixJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FDNUI7UUFDRCxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2IsQ0FBQztJQUVELHVDQUF1QztJQUM3QixPQUFPLENBQUMsSUFBVSxFQUFFLENBQVM7UUFDckMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUU5QyxLQUFLLElBQUksSUFBSSxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLElBQUksQ0FBQyxFQUFFO1lBQ2pELEtBQUssSUFBSSxDQUFDLEdBQUcsSUFBSSxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzNDLE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQzVDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7b0JBQzlCLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUM1QixJQUFJLENBQUMsR0FBRyxFQUFFO3dCQUNSLEdBQUcsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO3dCQUN4QixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7cUJBQ3hCO29CQUNELEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7aUJBQ1o7YUFDRjtTQUNGO0lBRUgsQ0FBQztJQUVELDhEQUE4RDtJQUM5RCxNQUFNLENBQUMsS0FBYSxFQUFFLENBQVM7UUFDN0IsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNqQyxJQUFJLEtBQUssRUFBRTtZQUNULEtBQUssR0FBZ0IsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLO2dCQUNoRCxDQUFDLENBQUMsT0FBTyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztvQkFDbkMsQ0FBQyxDQUFDLElBQUEsbUJBQVUsRUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFFaEQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ2pDO0lBQ0gsQ0FBQztJQUVELDBEQUEwRDtJQUNsRCxTQUFTLENBQUMsS0FBYSxFQUFFLENBQVMsRUFBRSxLQUE0QjtRQUN0RSxJQUFJLElBQUEsbUJBQVUsRUFBQyxLQUFLLENBQUMsRUFBRTtZQUNyQixLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRTtnQkFDeEIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JCLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN0QixJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7b0JBQ25CLEtBQUssTUFBTSxLQUFLLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTt3QkFDbkMsTUFBTSxDQUFDLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7d0JBQ2pELElBQUksQ0FBQyxFQUFFOzRCQUNMLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQzt5QkFDOUI7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGO2FBQU07WUFDTCxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN0QixJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztTQUN4QjtJQUNILENBQUM7SUFFRCxzQkFBc0I7SUFDdEIsWUFBWSxXQUE4QyxFQUFTLFFBQWlHLEVBQUUsYUFBcUM7UUFBeEksYUFBUSxHQUFSLFFBQVEsQ0FBeUY7UUFDbEssSUFBSSxDQUFDLFdBQVcsR0FBMEIsV0FBVyxDQUFDO1FBQ3RELElBQUksT0FBTyxhQUFhLEtBQUssUUFBUSxFQUFFO1lBQ3JDLElBQUksQ0FBQyxRQUFRLEdBQUcsYUFBYSxDQUFDO1lBQzlCLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1NBQzlDO2FBQU07WUFDTCxJQUFJLENBQUMsUUFBUSxHQUFHLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNqQyxJQUFJLENBQUMscUJBQXFCLEdBQUcsYUFBYSxDQUFDO1NBQzVDO1FBRUQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUVELGtCQUFrQjtJQUNsQixRQUFRLENBQUMsS0FBb0I7UUFDM0IsSUFBSSxLQUFLLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxFQUFFLEVBQUU7WUFDdkMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDakQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1NBQ3hDO1FBQ0QsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQzFCLENBQUM7SUFFRCx5QkFBeUI7SUFDekIsTUFBTSxDQUFDLEtBQW9CO1FBQ3pCLElBQUksS0FBSyxLQUFLLFNBQVMsSUFBSSxLQUFLLEtBQUssRUFBRSxFQUFFO1lBQ3ZDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNwRCxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDLENBQUM7U0FDeEM7UUFDRCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUM7SUFDMUIsQ0FBQztJQUVELDRDQUE0QztJQUM1QyxXQUFXLENBQUMsS0FBb0I7UUFDOUIsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNqQyxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO1FBQzlCLElBQUksR0FBRyxJQUFJLEtBQUssS0FBSyxTQUFTLElBQUksS0FBSyxLQUFLLEVBQUUsRUFBRTtZQUM5QyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQzNELEtBQUssTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUNqQixHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO2lCQUNaO1lBQ0gsQ0FBQyxDQUFDLENBQUM7U0FDSjtRQUNELElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ3RDLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQztJQUMxQixDQUFDO0lBRUQseUNBQXlDO0lBQ3pDLFFBQVEsQ0FBQyxLQUFvQjtRQUMzQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2pDLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFDOUIsSUFBSSxHQUFHLElBQUksS0FBSyxLQUFLLFNBQVMsSUFBSSxLQUFLLEtBQUssRUFBRSxFQUFFO1lBQzlDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzNCLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDNUQsS0FBSyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ2pCLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7aUJBQ1o7WUFDSCxDQUFDLENBQUMsQ0FBQztTQUNKO1FBQ0QsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDdEMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQzFCLENBQUM7SUFFRCxzQ0FBc0M7SUFDdEMsS0FBSyxDQUFDLEtBQWE7UUFDakIscURBQXFEO1FBQ3JELHFEQUFxRDtRQUNyRCxxREFBcUQ7UUFFckQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUU5QixLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDeEMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ3hCLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFO29CQUNuRixtQ0FBbUM7b0JBQ25DLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsRUFBRTt3QkFDaEMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztxQkFDYjtpQkFDRjthQUNGO1NBQ0Y7UUFFRCxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUN0QyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUM7SUFDMUIsQ0FBQztJQUNELGdDQUFnQztJQUNoQyxVQUFVLENBQUMsS0FBb0I7UUFDN0Isa0VBQWtFO1FBQ2xFLGtFQUFrRTtRQUNsRSxvQ0FBb0M7UUFFcEMsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUU5QixLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDeEMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ3hCLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFO29CQUNuRixtQ0FBbUM7b0JBQ25DLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLFVBQVUsQ0FBTyxLQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsRUFBRTt3QkFDMUQsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztxQkFDYjtpQkFDRjthQUNGO1NBQ0Y7UUFFRCxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUN0QyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUM7SUFDMUIsQ0FBQztJQUNELGdDQUFnQztJQUNoQyxRQUFRLENBQUMsS0FBb0I7UUFDM0IscUVBQXFFO1FBRXJFLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFFOUIsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxFQUFFO1lBQ3hDLEtBQUssTUFBTSxFQUFFLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUN4QixJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRTtvQkFDbkYsbUNBQW1DO29CQUNuQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQU8sS0FBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLEVBQUU7d0JBQ3hELEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7cUJBQ2I7aUJBQ0Y7YUFDRjtTQUNGO1FBRUQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDdEMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQzFCLENBQUM7SUFFRCxhQUFhO1FBQ1gsbUJBQW1CO0lBQ3JCLENBQUM7Q0FDRjtBQUVELGlDQUFpQztBQUNqQyxNQUFhLFNBQWdGLFNBQVEsR0FBaUM7SUFFcEksT0FBTyxDQUFDLENBQVMsRUFBRSxDQUFTO1FBQzFCLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNWLE9BQU8sQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUMzQjtRQUNELElBQUksQ0FBQyxFQUFFO1lBQ0wsT0FBTyxDQUFDLENBQUM7U0FDVjtRQUNELElBQUksQ0FBQyxFQUFFO1lBQ0wsT0FBTyxDQUFDLENBQUMsQ0FBQztTQUNYO1FBQ0QsT0FBTyxDQUFDLENBQUM7SUFDWCxDQUFDO0lBRUQsZ0RBQWdEO0lBQ2hELE1BQU0sQ0FBQyxLQUFhO1FBQ2xCLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztDQUNGO0FBbkJELDhCQW1CQztBQUVELFNBQVMsU0FBUyxDQUFDLEtBQWEsRUFBRSxDQUFTO0lBQ3pDLE1BQU0sQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDM0IsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7SUFDckIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQ1QsQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUNQO0lBQ0QsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM5QixDQUFDO0FBRUQsTUFBYSxXQUFrRixTQUFRLFNBQStCO0lBRTFILFVBQVUsR0FBRyxJQUFJLHNCQUFLLENBQXNCLFNBQVMsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDckUsV0FBVyxHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO0lBRXpDLGFBQWE7UUFDcEIsd0RBQXdEO1FBQ3hELE1BQU0sR0FBRyxHQUFHLElBQUksY0FBTyxFQUFpQyxDQUFDO1FBRXpELEtBQUssTUFBTSxnQkFBZ0IsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxFQUFFO1lBQ3BELEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLGdCQUFnQixDQUFDLENBQUM7U0FDL0Q7UUFFRCxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDVixPQUFPLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFO1lBQ25CLENBQUMsRUFBRSxDQUFDO1lBQ0osS0FBSyxNQUFNLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRTtnQkFDbkQsMkJBQTJCO2dCQUMzQixHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNsQixJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO29CQUMxQiw2QkFBNkI7b0JBQzdCLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDNUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO2lCQUM5QztxQkFBTTtvQkFDTCxLQUFLLE1BQU0sSUFBSSxJQUFJLFNBQVMsRUFBRTt3QkFDNUIsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO3FCQUN2QztpQkFDRjthQUNGO1NBQ0Y7SUFDSCxDQUFDO0lBRUQsZ0JBQWdCO0lBQ1AsUUFBUSxDQUFDLElBQVU7UUFDMUIsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDaEQsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUVELGNBQWMsQ0FBQyxFQUFVO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDbEMsQ0FBQztJQUVELGlCQUFpQixDQUFDLEtBQWE7UUFDN0IsSUFBSSxLQUFLLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxFQUFFLEVBQUU7WUFDdkMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDM0MsSUFBSSxPQUFPLEVBQUU7Z0JBQ1gsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7YUFDbEM7aUJBQ0k7Z0JBQ0gsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQzNCO1NBQ0Y7UUFDRCxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUM7SUFDMUIsQ0FBQztJQUVELHNEQUFzRDtJQUM3QyxXQUFXLENBQUMsT0FBWTtRQUMvQixLQUFLLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzNCLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztJQUN2QixDQUFDO0NBQ0Y7QUE3REQsa0NBNkRDO0FBRUQsaUVBQWlFO0FBQ2pFLE1BQWEsU0FBMEUsU0FBUSxHQUEyQjtJQUN4SCxPQUFPLENBQUMsQ0FBUyxFQUFFLENBQVM7UUFDMUIsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3RCLENBQUM7SUFDRCxNQUFNLENBQUMsS0FBc0I7UUFDM0IsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUU7WUFDN0IsT0FBTyxJQUFJLGVBQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUMxQjtRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUNtQixPQUFPLENBQUMsSUFBWSxFQUFFLENBQVM7UUFDakQsV0FBVztJQUNiLENBQUM7SUFFRCxVQUFVLENBQUMsS0FBcUI7UUFFOUIscURBQXFEO1FBQ3JELHFEQUFxRDtRQUNyRCxxREFBcUQ7UUFFckQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztRQUM5QixNQUFNLEtBQUssR0FBRyxJQUFJLGNBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUUvQixLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDeEMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBRXhCLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFO29CQUNuRixtQ0FBbUM7b0JBQ25DLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTt3QkFDdkIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztxQkFDYjtpQkFDRjthQUNGO1NBQ0Y7UUFFRCxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUN0QyxPQUFPLElBQUksQ0FBQyxXQUFXLENBQUM7SUFDMUIsQ0FBQztJQUVRLFNBQVM7UUFDaEIsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQ2pDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDO1FBRXpCLE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7Q0FDRjtBQTdDRCw4QkE2Q0M7QUFFRDs7Ozs7R0FLRztBQUNILE1BQXNCLFdBQVc7SUEwRVo7SUF6RW5CLGlEQUFpRDtJQUN4QyxlQUFlLEdBQUcsSUFBSSxHQUFHLEVBQW1DLENBQUM7SUFFdEU7Ozs7T0FJRztJQUNILGdCQUFnQixDQUFlO0lBRS9COzs7O09BSUc7SUFDSCxNQUFNLENBQUMsU0FBMkI7UUFDaEMsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7WUFDekIsTUFBTSxRQUFRLEdBQUcsSUFBSSxHQUFHLEVBQVUsQ0FBQztZQUNuQyxLQUFLLE1BQU0sSUFBSSxJQUFJLFNBQVMsRUFBRTtnQkFDNUIsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUNuQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUNwQjthQUNGO1lBQ0QsSUFBSSxDQUFDLGdCQUFnQixHQUFHLFFBQVEsQ0FBQztTQUNsQzthQUFNO1lBQ0wsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksR0FBRyxDQUFTLFNBQVMsQ0FBQyxDQUFDO1NBQ3BEO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUztRQUNQLE1BQU0sTUFBTSxHQUFRLEVBQ25CLENBQUM7UUFDRixLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUN4RCxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1NBQ2hDO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsV0FBVyxDQUFDLE9BQVk7UUFDdEIsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDeEQsSUFBSSxVQUFVLEdBQUcsS0FBSyxDQUFDO1lBQ3ZCLEtBQUssTUFBTSxhQUFhLElBQUksSUFBSSxDQUFDLHFCQUFxQixFQUFFO2dCQUN0RCxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7Z0JBQ3hDLElBQUksUUFBUSxFQUFFO29CQUNaLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQzNCLFVBQVUsR0FBRyxJQUFJLENBQUM7b0JBQ2xCLE1BQU07aUJBQ1A7YUFDRjtZQUVELElBQUksQ0FBQyxVQUFVLEVBQUU7Z0JBQ2YsTUFBTSxJQUFJLEtBQUssQ0FBQyxJQUFBLFFBQUMsRUFBQSwrQkFBK0IsR0FBRyxFQUFFLENBQUMsQ0FBQzthQUN4RDtTQUNGO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxLQUFLO1FBQ1AsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQztJQUNySSxDQUFDO0lBRUQsZ0JBQWdCO0lBQ2hCLFlBQW1CLEtBQTJCO1FBQTNCLFVBQUssR0FBTCxLQUFLLENBQXNCO0lBQzlDLENBQUM7Q0FDRjtBQTVFRCxrQ0E0RUMifQ==
// SIG // Begin signature block
// SIG // MIIoKwYJKoZIhvcNAQcCoIIoHDCCKBgCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // rUxTnd0MD8ejc31qhl/mkzqwrzpr66oPDrfFaZv8BjWg
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
// SIG // a/15n8G9bW1qyVJzEw16UM0xghoNMIIaCQIBATCBlTB+
// SIG // MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
// SIG // bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
// SIG // cm9zb2Z0IENvcnBvcmF0aW9uMSgwJgYDVQQDEx9NaWNy
// SIG // b3NvZnQgQ29kZSBTaWduaW5nIFBDQSAyMDExAhMzAAAE
// SIG // BGx0Bv9XKydyAAAAAAQEMA0GCWCGSAFlAwQCAQUAoIGu
// SIG // MBkGCSqGSIb3DQEJAzEMBgorBgEEAYI3AgEEMBwGCisG
// SIG // AQQBgjcCAQsxDjAMBgorBgEEAYI3AgEVMC8GCSqGSIb3
// SIG // DQEJBDEiBCAlr2pDesqsIwTvNrcCSPfHM0vXIA6fOTL2
// SIG // ZPJ81kU1+TBCBgorBgEEAYI3AgEMMTQwMqAUgBIATQBp
// SIG // AGMAcgBvAHMAbwBmAHShGoAYaHR0cDovL3d3dy5taWNy
// SIG // b3NvZnQuY29tMA0GCSqGSIb3DQEBAQUABIIBAJnUfKBo
// SIG // 1hLfA6nWyMsQQ7bHAuIaLx7JXzmfANKjuUj0uHfVOSBy
// SIG // Hq/wLOYYv/UefwNo6nHRgd4K9tkV32eEzF1SWazThPRv
// SIG // LaYHSQ5W9T90FW5rPwNYYRN6VL3rxNSznSyazYLVIoJ0
// SIG // tFkOZm3xaOlFa8BAH+zBKZidXkT5IkNw/3A9SkyVpUen
// SIG // 6ynR6JBA4Hhfh+RXDzwmlv174uSpfQzc1qQyRJwyK3ze
// SIG // uvQlRqffH3nuuhZawQkz9pn+JA8fOJdlNoTKuEqq0M2k
// SIG // BlWJ+J0yDibKjEaqDfHfzmqVkLPM3fZ3NC3WufZZWwex
// SIG // 69YZAvcqoFEGTZIUuXOLH+9zvtWhgheXMIIXkwYKKwYB
// SIG // BAGCNwMDATGCF4Mwghd/BgkqhkiG9w0BBwKgghdwMIIX
// SIG // bAIBAzEPMA0GCWCGSAFlAwQCAQUAMIIBUgYLKoZIhvcN
// SIG // AQkQAQSgggFBBIIBPTCCATkCAQEGCisGAQQBhFkKAwEw
// SIG // MTANBglghkgBZQMEAgEFAAQgx3+BpE3HSRLY4C5AiFVd
// SIG // vxqJC0lFgR4H7fLFjedT4OwCBmf3yUTBbRgTMjAyNTA0
// SIG // MTYwMTA1NTAuNzA0WjAEgAIB9KCB0aSBzjCByzELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjElMCMGA1UECxMcTWljcm9zb2Z0
// SIG // IEFtZXJpY2EgT3BlcmF0aW9uczEnMCUGA1UECxMeblNo
// SIG // aWVsZCBUU1MgRVNOOjkyMDAtMDVFMC1EOTQ3MSUwIwYD
// SIG // VQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBTZXJ2aWNl
// SIG // oIIR7TCCByAwggUIoAMCAQICEzMAAAIJCAfg+VyM5lUA
// SIG // AQAAAgkwDQYJKoZIhvcNAQELBQAwfDELMAkGA1UEBhMC
// SIG // VVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcT
// SIG // B1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jw
// SIG // b3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUt
// SIG // U3RhbXAgUENBIDIwMTAwHhcNMjUwMTMwMTk0MjU1WhcN
// SIG // MjYwNDIyMTk0MjU1WjCByzELMAkGA1UEBhMCVVMxEzAR
// SIG // BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1v
// SIG // bmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
// SIG // bjElMCMGA1UECxMcTWljcm9zb2Z0IEFtZXJpY2EgT3Bl
// SIG // cmF0aW9uczEnMCUGA1UECxMeblNoaWVsZCBUU1MgRVNO
// SIG // OjkyMDAtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNyb3Nv
// SIG // ZnQgVGltZS1TdGFtcCBTZXJ2aWNlMIICIjANBgkqhkiG
// SIG // 9w0BAQEFAAOCAg8AMIICCgKCAgEAwpRKMPcuDN39Uvc9
// SIG // cbTRBE8Fi9bxIosNKA+0lxHb+LHT9MbFconb+iNq5hJf
// SIG // D2LPS3GY87FjhyO3UJES9vBj9wl3L2NGaup1rB2NkGpg
// SIG // mRSxdiJUR+gR8dkZDe2UQyprOwTqOCBgUZQjJFL/Tff7
// SIG // cDswJKVjbDN2/wUMXMIVYLEKrUPDRD1Lokfhlea3UB1E
// SIG // +KY4oWU5CcK2pYs9GW2KVEx+TpIt3dwacfaoj64geoYT
// SIG // Xxj45dDyKdtw+e/a6VumZj6j0/I9dil+8kmcDbsbNz2L
// SIG // xf8NdxrEV5MyGyMiyhD84/Zc5pqxdsI771K8fQGcOxi0
// SIG // l5NvA59V0n+toW5BblBsDxS6dxG0aiFZgWeNsHM+ZkiC
// SIG // Ast0LP4cIRGIVJ3ZwAYDaQ+WrwCzle7FHyaxw2V1+n/Y
// SIG // IG4yAOo9p4UgEiKpfBeS7CgcNET7Q7st49gj8bU5maM2
// SIG // yyvEzLcQ4jAoMU6X4OYmFL8oVeGqmgy8EQbKAUYTv/oc
// SIG // Mmyp2MF8Snnjq7DsEC52jhOQZhSWFgThc93fPCwSvUEQ
// SIG // YHRB+Qi1Ye8JIDCHofenB+fh9MRL5oOre7s7ZV19kle8
// SIG // XVGD8QN7441dxJFe2m0hw+Rx0GU63dxarA/1TmAAlFQT
// SIG // 68RfpFK2Rl8WCJ2U6a2DGBKulCBtQ0+KQlT/Q3GgixiD
// SIG // mBCdYNMCAwEAAaOCAUkwggFFMB0GA1UdDgQWBBRJi+jR
// SIG // xF045b3wL0DNtXczFpPK0jAfBgNVHSMEGDAWgBSfpxVd
// SIG // AF5iXYP05dJlpxtTNRnpcjBfBgNVHR8EWDBWMFSgUqBQ
// SIG // hk5odHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3Bz
// SIG // L2NybC9NaWNyb3NvZnQlMjBUaW1lLVN0YW1wJTIwUENB
// SIG // JTIwMjAxMCgxKS5jcmwwbAYIKwYBBQUHAQEEYDBeMFwG
// SIG // CCsGAQUFBzAChlBodHRwOi8vd3d3Lm1pY3Jvc29mdC5j
// SIG // b20vcGtpb3BzL2NlcnRzL01pY3Jvc29mdCUyMFRpbWUt
// SIG // U3RhbXAlMjBQQ0ElMjAyMDEwKDEpLmNydDAMBgNVHRMB
// SIG // Af8EAjAAMBYGA1UdJQEB/wQMMAoGCCsGAQUFBwMIMA4G
// SIG // A1UdDwEB/wQEAwIHgDANBgkqhkiG9w0BAQsFAAOCAgEA
// SIG // XF58bzg8JOIf421AbJxZRba0rgQWW+8EmX2uZSkTEzXz
// SIG // ZZmgAuG3e1qNCOYTMbBCVMrqR8IeJA+apEWXMyHNIyAA
// SIG // UENcQ1AWvlk8a6f1AKgte4oxQnj2SmFYzax3/wZo8+xW
// SIG // jiONZMbnkYcCzSHENoJgag0eVuE0tobUSWMmQLO43yZm
// SIG // w7U3FDjIRJdTlpcfxZ73EG6LeVT82lMIk+jYnvJej2Y6
// SIG // ELLsYmrLkgJsSiEHbB5yeUKJKsHcql4tRWQ7RE1b213w
// SIG // 7KH807WuHp9qn+PIcxGcFL25M+bJrfPdJ1QCu5M9nK68
// SIG // zd4aZ3xbn7af61y1k78T0HH1l4hLiFHdhoO3kfELcirS
// SIG // Q1PPjw8BApM6GiY2xgiqsfREoBSc861zcIYV+kXPINhF
// SIG // P/ut5pqlnghf5CThYNnicO2rv2mxEoKtxGs8g9VZS/h2
// SIG // l/jARxs0Jh7bzpt0JeMFUzd1qvF/GwkevKoheaxWrJuE
// SIG // cRes2o2Xkhwv6kud9+v+GjA6rFejvOkZTzwmBiTj7X9j
// SIG // Gyju1ySXi/1EDdHN7oseUTE6OunWwE8T1BRBuT4eDx8x
// SIG // o1GxDuw9+S7hAYohvGK5TETpBpd3wUJfW1m4MPQiFEG8
// SIG // KuXE2hMZXxKTHUqMnSaJVE0A+RCyhs9UyWoU4nXdtMJc
// SIG // IuQZN+lyJs7B+GLNeYl0XwIwggdxMIIFWaADAgECAhMz
// SIG // AAAAFcXna54Cm0mZAAAAAAAVMA0GCSqGSIb3DQEBCwUA
// SIG // MIGIMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGlu
// SIG // Z3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMV
// SIG // TWljcm9zb2Z0IENvcnBvcmF0aW9uMTIwMAYDVQQDEylN
// SIG // aWNyb3NvZnQgUm9vdCBDZXJ0aWZpY2F0ZSBBdXRob3Jp
// SIG // dHkgMjAxMDAeFw0yMTA5MzAxODIyMjVaFw0zMDA5MzAx
// SIG // ODMyMjVaMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpX
// SIG // YXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
// SIG // VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNV
// SIG // BAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEw
// SIG // MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA
// SIG // 5OGmTOe0ciELeaLL1yR5vQ7VgtP97pwHB9KpbE51yMo1
// SIG // V/YBf2xK4OK9uT4XYDP/XE/HZveVU3Fa4n5KWv64NmeF
// SIG // RiMMtY0Tz3cywBAY6GB9alKDRLemjkZrBxTzxXb1hlDc
// SIG // wUTIcVxRMTegCjhuje3XD9gmU3w5YQJ6xKr9cmmvHaus
// SIG // 9ja+NSZk2pg7uhp7M62AW36MEBydUv626GIl3GoPz130
// SIG // /o5Tz9bshVZN7928jaTjkY+yOSxRnOlwaQ3KNi1wjjHI
// SIG // NSi947SHJMPgyY9+tVSP3PoFVZhtaDuaRr3tpK56KTes
// SIG // y+uDRedGbsoy1cCGMFxPLOJiss254o2I5JasAUq7vnGp
// SIG // F1tnYN74kpEeHT39IM9zfUGaRnXNxF803RKJ1v2lIH1+
// SIG // /NmeRd+2ci/bfV+AutuqfjbsNkz2K26oElHovwUDo9Fz
// SIG // pk03dJQcNIIP8BDyt0cY7afomXw/TNuvXsLz1dhzPUNO
// SIG // wTM5TI4CvEJoLhDqhFFG4tG9ahhaYQFzymeiXtcodgLi
// SIG // Mxhy16cg8ML6EgrXY28MyTZki1ugpoMhXV8wdJGUlNi5
// SIG // UPkLiWHzNgY1GIRH29wb0f2y1BzFa/ZcUlFdEtsluq9Q
// SIG // BXpsxREdcu+N+VLEhReTwDwV2xo3xwgVGD94q0W29R6H
// SIG // XtqPnhZyacaue7e3PmriLq0CAwEAAaOCAd0wggHZMBIG
// SIG // CSsGAQQBgjcVAQQFAgMBAAEwIwYJKwYBBAGCNxUCBBYE
// SIG // FCqnUv5kxJq+gpE8RjUpzxD/LwTuMB0GA1UdDgQWBBSf
// SIG // pxVdAF5iXYP05dJlpxtTNRnpcjBcBgNVHSAEVTBTMFEG
// SIG // DCsGAQQBgjdMg30BATBBMD8GCCsGAQUFBwIBFjNodHRw
// SIG // Oi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL0RvY3Mv
// SIG // UmVwb3NpdG9yeS5odG0wEwYDVR0lBAwwCgYIKwYBBQUH
// SIG // AwgwGQYJKwYBBAGCNxQCBAweCgBTAHUAYgBDAEEwCwYD
// SIG // VR0PBAQDAgGGMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0j
// SIG // BBgwFoAU1fZWy4/oolxiaNE9lJBb186aGMQwVgYDVR0f
// SIG // BE8wTTBLoEmgR4ZFaHR0cDovL2NybC5taWNyb3NvZnQu
// SIG // Y29tL3BraS9jcmwvcHJvZHVjdHMvTWljUm9vQ2VyQXV0
// SIG // XzIwMTAtMDYtMjMuY3JsMFoGCCsGAQUFBwEBBE4wTDBK
// SIG // BggrBgEFBQcwAoY+aHR0cDovL3d3dy5taWNyb3NvZnQu
// SIG // Y29tL3BraS9jZXJ0cy9NaWNSb29DZXJBdXRfMjAxMC0w
// SIG // Ni0yMy5jcnQwDQYJKoZIhvcNAQELBQADggIBAJ1Vffwq
// SIG // reEsH2cBMSRb4Z5yS/ypb+pcFLY+TkdkeLEGk5c9MTO1
// SIG // OdfCcTY/2mRsfNB1OW27DzHkwo/7bNGhlBgi7ulmZzpT
// SIG // Td2YurYeeNg2LpypglYAA7AFvonoaeC6Ce5732pvvinL
// SIG // btg/SHUB2RjebYIM9W0jVOR4U3UkV7ndn/OOPcbzaN9l
// SIG // 9qRWqveVtihVJ9AkvUCgvxm2EhIRXT0n4ECWOKz3+SmJ
// SIG // w7wXsFSFQrP8DJ6LGYnn8AtqgcKBGUIZUnWKNsIdw2Fz
// SIG // Lixre24/LAl4FOmRsqlb30mjdAy87JGA0j3mSj5mO0+7
// SIG // hvoyGtmW9I/2kQH2zsZ0/fZMcm8Qq3UwxTSwethQ/gpY
// SIG // 3UA8x1RtnWN0SCyxTkctwRQEcb9k+SS+c23Kjgm9swFX
// SIG // SVRk2XPXfx5bRAGOWhmRaw2fpCjcZxkoJLo4S5pu+yFU
// SIG // a2pFEUep8beuyOiJXk+d0tBMdrVXVAmxaQFEfnyhYWxz
// SIG // /gq77EFmPWn9y8FBSX5+k77L+DvktxW/tM4+pTFRhLy/
// SIG // AsGConsXHRWJjXD+57XQKBqJC4822rpM+Zv/Cuk0+CQ1
// SIG // ZyvgDbjmjJnW4SLq8CdCPSWU5nR0W2rRnj7tfqAxM328
// SIG // y+l7vzhwRNGQ8cirOoo6CGJ/2XBjU02N7oJtpQUQwXEG
// SIG // ahC0HVUzWLOhcGbyoYIDUDCCAjgCAQEwgfmhgdGkgc4w
// SIG // gcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5n
// SIG // dG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVN
// SIG // aWNyb3NvZnQgQ29ycG9yYXRpb24xJTAjBgNVBAsTHE1p
// SIG // Y3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMxJzAlBgNV
// SIG // BAsTHm5TaGllbGQgVFNTIEVTTjo5MjAwLTA1RTAtRDk0
// SIG // NzElMCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAg
// SIG // U2VydmljZaIjCgEBMAcGBSsOAwIaAxUAfO+tqz00HeyJ
// SIG // wwkHW9ZIBSkJAkSggYMwgYCkfjB8MQswCQYDVQQGEwJV
// SIG // UzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
// SIG // UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
// SIG // cmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1T
// SIG // dGFtcCBQQ0EgMjAxMDANBgkqhkiG9w0BAQsFAAIFAOuo
// SIG // 3s4wIhgPMjAyNTA0MTUxMzM0MDZaGA8yMDI1MDQxNjEz
// SIG // MzQwNlowdzA9BgorBgEEAYRZCgQBMS8wLTAKAgUA66je
// SIG // zgIBADAKAgEAAgIytAIB/zAHAgEAAgIR8zAKAgUA66ow
// SIG // TgIBADA2BgorBgEEAYRZCgQCMSgwJjAMBgorBgEEAYRZ
// SIG // CgMCoAowCAIBAAIDB6EgoQowCAIBAAIDAYagMA0GCSqG
// SIG // SIb3DQEBCwUAA4IBAQAZDhDFMWBKhfAByWrPTc8TEmqz
// SIG // Nv59ztD8uoCrmHeYRhooOaXVew6CZONOPINleM2hSNgK
// SIG // LhnIZ4qdD4FS2kbMV3Wyz/u0qE1r8pb+OqiAsnTvpulT
// SIG // V9z3YdqB363shZ463u6gj0/TaJdbUzxiaSy2PH8hv2Nb
// SIG // s3GFGg8jwPcxYhb4QTHHIDgznZX6yde3E737y+fVzaNB
// SIG // pxkC+zalebSNpXNPQp4FYOLbTnJxewEGYCZ2weUZv7vg
// SIG // roP3eA4fEFvW/RDNpx+CCo6H7HlfVhh8ORR9tFF7DS7D
// SIG // JF5yl8nwhBx9zPP2/vv6PsKT1agwPgslTefSbsF0WJb9
// SIG // XVreXr0YMYIEDTCCBAkCAQEwgZMwfDELMAkGA1UEBhMC
// SIG // VVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcT
// SIG // B1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jw
// SIG // b3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUt
// SIG // U3RhbXAgUENBIDIwMTACEzMAAAIJCAfg+VyM5lUAAQAA
// SIG // AgkwDQYJYIZIAWUDBAIBBQCgggFKMBoGCSqGSIb3DQEJ
// SIG // AzENBgsqhkiG9w0BCRABBDAvBgkqhkiG9w0BCQQxIgQg
// SIG // CQU90zcSmpUgYOOYhCORCdFeaTasc4CnmVYf7M2K4nAw
// SIG // gfoGCyqGSIb3DQEJEAIvMYHqMIHnMIHkMIG9BCBoGywe
// SIG // yL30Ai5lDlGYY3VKivG4pHwemVVXaE4zcIUTPjCBmDCB
// SIG // gKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
// SIG // aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
// SIG // ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMT
// SIG // HU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwAhMz
// SIG // AAACCQgH4PlcjOZVAAEAAAIJMCIEIEiAINZ1s6zSgYWg
// SIG // E928hm17Yho0uH9YJieXnZAwJPIxMA0GCSqGSIb3DQEB
// SIG // CwUABIICAGDUs+bxLTnkZ3Dl8BsW+jRvFIH7IHsmjbi9
// SIG // NAYs6RZe83e3O0EDGzDPF9EIjZkR1V3l3KUMg2EuLZ/Z
// SIG // evqqO40os17LGbnyRRM9D+AFTy/a27Jz0ziszDgpMgVu
// SIG // LTX7NSJFDmsBhpNnrs6mgZbw0u9Jlabb6WerucE2CTKp
// SIG // oJqjwvCcSvMzXaMWSQTid3Ryzs2oDRfGMBR+ZPcLQCPu
// SIG // DPeQMWJ39e1K8UO9ICpFHUOps6o10hJ+4vrerOGf2L9G
// SIG // ut7WNEXGuLiQ6M4w6xMOuYG1nxHa5EdNyL52jgNPBKA1
// SIG // U6UcnSCJ1tHWCupbfpblR9zScEMAGCYTqTfPmiNmsh5p
// SIG // Qn75RdML70SVuUFlSnzPUNaHq7uAccIrlmcyOSQ4ny21
// SIG // lJaoHczgjA/Bl14iTqWjUCIunFVbhF6q8RXIIFhVNgrE
// SIG // yllq4ImUUbiQzJwaj/ESWbH0XEbiSR9nFKPzzlSPBDxp
// SIG // gFjKKoergy3HD5npxnaYPvuxHdV92d6KTwmZmZiXhEtB
// SIG // +1/QduexXhq3Oby0ZroyRUg7LTG4HNvVIyQmXt8O0Knw
// SIG // CSZJdxnuEVuD/BxykFNkhzwasOgc6hyK1oZXNFxAAnEE
// SIG // Z+xkG+YF6tg1oZm2aGyn8JpvkdgJ7fAnTB2o4cFCFO26
// SIG // BA5mghyxFFuSNyByADkR96cngEEgvUcb
// SIG // End signature block
