/*
 * mithgrid JavaScript Library v0.0.1
 *
 * Date: Sat Jul 2 16:49:46 2011 -0400
 *
 * (c) Copyright University of Maryland 2011.  All rights reserved.
 *
 * (c) Copyright Texas A&M University 2010.  All rights reserved.
 *
 * Portions of this code are copied from The SIMILE Project:
 *  (c) Copyright The SIMILE Project 2006. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * 3. The name of the author may not be used to endorse or promote products
 *    derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 * NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

var MITHGrid = MITHGrid || {};

(function($, MITHGrid) {


    if (window.console !== undefined && window.console.log !== undefined) {
        MITHGrid.debug = function() {
	        //console.log.call(arguments);
    
            console.log(Array.prototype.slice.call(arguments));
        };
    }
    else {
        MITHGrid.debug = function() {};
    }

    var genericNamespacer = function(base, nom) {
        if (typeof(base[nom]) == "undefined") {
            base[nom] = {};
            base[nom].namespace = function(nom2) {
                return genericNamespacer(base[nom], nom2);
            };
            base[nom].debug = MITHGrid.debug;
        }
        return base[nom];
    };

    MITHGrid.namespace = function(nom) {
        return genericNamespacer(MITHGrid, nom);
    };

    MITHGrid.Set = function(values) {
        var that = {},
        items = {},
        count = 0,
        recalc_items = true,
        items_list = [];

        that.isSet = true;

        that.items = function() {
            if (recalc_items) {
                items_list = [];
                for (var i in items) {
                    if (typeof(i) == "string" && items[i] === true) {
                        items_list.push(i);
                    }
                }
            }
            return items_list;
        };

        that.add = function(item) {
            if (! (item in items)) {
                items[item] = true;
                recalc_items = true;
                count += 1;
            }
        };

        that.remove = function(item) {
            if (item in items) {
                delete items[item];
                recalc_items = true;
                count -= 1;
            }
        };

        that.visit = function(fn) {
            var o;
            for (o in items) {
                if (fn(o) === true) {
                    break;
                }
            }
        };

        that.contains = function(o) {
            return (o in items);
        };

        that.size = function() {
            if (recalc_items) {
                return that.items().length;
            }
            else {
                return items_list.length;
            }
        };

        if (values instanceof Array) {
            $(values).each(function(idx, i) {
                that.add(i);
            });
        }

        return that;
    };

    MITHGrid.Type = function(t) {
        var that = {};

        that.name = t;
        that.custom = {};

        return that;
    };

    MITHGrid.Property = function(p) {
        var that = {};

        that.name = p;

        that.getValueType = function() {
            return that.valueType || 'text';
        };

        return that;
    };

    var sources = {};

    MITHGrid.DataSource = function(options) {
        var that,
        prop,
        quiesc_events = false,
        set = MITHGrid.Set();

        if (typeof(sources[options.source]) != "undefined") {
            return sources[options.source];
        }
        that = fluid.initView("MITHGrid.DataSource", $(window), options);
        sources[options.source] = that;

        that.source = options.source;

        that.types = {};
        that.properties = {};
        that.spo = {};
        that.ops = {};
        that.items = set.items;

        that.addProperty = function(nom, options) {
            var prop = MITHGrid.Property(nom);
            prop.valueType = options.valueType;
            that.properties[nom] = prop;
        };

        that.addType = function(nom, options) {
            var type = MITHGrid.Type(nom);
            that.types[nom] = type;
        };

        /* In MITHGrid, the app and plugins would populate the types and properties based on what they need */
        /* For us, we have:
		 * View
		 * Transition
		 * TansitionCondition (params, param, ...)
		 * GeneralAction
		 * GeneralStructural
		 */

        /*
		*** Application
		* id:
		* view: list of item ids pointing to View items
		* initialization-action: list of item ids pointing to GeneralAction items
		*
		*** View type has the following properties
		* id: unique id in the system
		* transition: list of item ids
		* label: (unique name for the application)
		* initialization-action: list of item ids pointing to GeneralAction items
		* position-x:, position-y: - points on drawing board
		*
		*** Transition type
		* id
		* transitions-to: item id pointing to target view
		* condition: list of parameters expected
		* action: list of item ids pointing to GeneralAction items
		* path: info on path between views
		*
		***
		*/



        that.getItem = function(id) {
            if (id in that.spo) {
                return that.spo[id].values;
            }
            return {};
        };

        that.getItems = function(ids) {
            if (!$.isArray(ids)) {
                return [that.getItem(ids)];
            }

            $.map(ids,
            function(id, idx) {
                return that.getItem(id);
            });
        };

        that.fetchData = function(uri) {
            $.ajax({
                url: uri,
                dataType: "json",
                success: function(data, textStatus) {
                    that.loadData(data);
                }
            });
        };

        var indexPut = function(index, x, y, z) {
            var hash = index[x],
            array,
            counts,
            i,
            n;

            if (!hash) {
                hash = {
                    values: {},
                    counts: {}
                };
                index[x] = hash;
            }

            array = hash.values[y];
            counts = hash.counts[y];

            if (!array) {
                array = [];
                hash.values[y] = array;
            }
            if (!counts) {
                counts = {};
                hash.counts[y] = counts;
            }
            else {
                if ($.inArray(z, array) != -1) {
                    counts[z] += 1;
                    return;
                }
            }
            array.push(z);
            counts[z] = 1;
        };

        that.updateItems = function(items) {
            var spo,
            ops,
            indexTriple,
            n,
            chunk_size,
            f,
            id_list = [],
            entry;

            var indexRemove = function(index, x, y, z) {
                var hash = index[x],
                array,
                counts,
                i,
                n;

                if (!hash) {
                    return;
                    // nothing to remove
                    //hash = { values: { }, counts: { }};
                    //index[x] = hash;
                }

                array = hash.values[y];
                counts = hash.counts[y];
                if (!array) {
                    return;
                    // nothing to remove
                    //		array = new Array();
                    //		hash.values[y] = array;
                }
                if (!counts) {
                    return;
                    // nothing to remove
                    //		counts = { };
                    //		hash.counts[y] = counts;
                }
                // we need to remove the old z values
                counts[z] -= 1;
                if (counts[z] < 1) {
                    i = $.inArray(z, array);
                    if (i === 0) {
                        array = array.slice(1);
                    }
                    else if (i == array.length - 1) {
                        array = array.slice(0, i - 1);
                    }
                    else {
                        array = array.slice(0, i - 1).concat(array.slice(i + 1));
                    }
                    hash.values[y] = array;
                }
            };

            var indexPutFn = function(s, p, o) {
                indexPut(that.spo, s, p, o);
                indexPut(that.ops, o, p, s);
            };

            var indexRemoveFn = function(s, p, o) {
                indexRemove(that.spo, s, p, o);
                indexRemove(that.ops, o, p, s);
            };

            var updateItem = function(entry, indexPutFn, indexRemoveFn) {
                // we only update things that are different from the old_item
                // we also only update properties that are in the new item
                // if anything is changed, we return true
                //   otherwise, we return false
                var old_item,
                id = item.id,
                type = item.type,
                changed = false;

                if ($.isArray(id)) { id = id[0]; }
                if ($.isArray(type)) { type = type[0]; }

                old_item = that.getItem(id);

                for (var p in entry) {
                    if (typeof(p) != "string" || p == "id" || p == "type") {
                        continue;
                    }
                    // if entry[p] and old_item[p] have the same members in the same order, then
                    // we do nothing
                    var items = entry[p];
                    if (!$.isArray(items)) {
                        items = [items];
                    }
                    var s = items.length;
                    if ((p in old_item) && s == old_item[p].length) {
                        var items_same = true;
                        $.each(items,
                        function(idx, i) {
                            if (i != old_item[p][idx]) {
                                items_same = false;
                            }
                        });
                        if (items_same) {
                            continue;
                        }
                    }
                    changed = true;
                    if (p in old_item) {
                        $.each(old_item[p],
                        function(idx, o) {
                            indexRemoveFn(id, p, o);
                        });
                    }
                    $.each(items,
                    function(idx, o) {
                        indexPutFn(id, p, o);
                    });
                }
                return changed;
            };

            that.events.onBeforeUpdating.fire(that);

            try {
                n = items.length;
                chunk_size = parseInt(n / 100, 10);
                if (chunk_size > 200) {
                    chunk_size = 200;
                }
                if (chunk_size < 1) {
                    chunk_size = 1;
                }

                f = function(start) {
                    var end,
                    i;

                    end = start + chunk_size;
                    if (end > n) {
                        end = n;
                    }

                    try {
                        for (i = start; i < end; i += 1) {
                            entry = items[i];
                            if (typeof(entry) == "object") {
                                if (updateItem(entry, indexPutFn, indexRemoveFn)) {
                                    id_list.push(entry.id);
                                }
                            }
                        }
                    }
                    catch(e) {
                        MITHGrid.debug("loadData failed: ", e);
                    }

                    if (end < n) {
                        setTimeout(function() {
                            f(end);
                        },
                        0);
                    }
                    else {
                        setTimeout(function() {
                            that.events.onAfterUpdating.fire(that);
                            setTimeout(function() {
                                that.events.onModelChange.fire(that, id_list);
                            },
                            0);
                        },
                        0);
                    }
                };
                f(0);
            }
            catch(e) {
                MITHGrid.debug("updateItems failed:", e);
            }
        };


        that.loadItems = function(items) {
            var spo,
            ops,
            indexTriple,
            entry,
            n,
            id_list = [],
            f;

            var indexFn = function(s, p, o) {
                indexPut(that.spo, s, p, o);
                indexPut(that.ops, o, p, s);
            };

            var loadItem = function(item, indexFN) {
                var id,
                type,
                p,
                i,
                n;

                if (! ("id" in item)) {
                    MITHGrid.debug("Item entry has no id: ", item);
                    return;
                }
                if (! ("type" in item)) {
                    MITHGrid.debug("Item entry has no type: ", item);
                    return;
                }

                id = item.id;
                type = item.type;

                if ($.isArray(id)) { id = id[0]; }
                if ($.isArray(type)) { type = type[0]; }

                set.add(id);
                id_list.push(id);

                indexFn(id, "type", type);
                indexFn(id, "id", id);

                for (p in item) {
                    if (typeof(p) != "string") {
                        continue;
                    }

                    if (p != "id" && p != "type") {
                        v = item[p];
                        if ($.isArray(v)) {
                            for (i = 0, n = v.length; i < n; i += 1) {
                                indexFn(id, p, v[i]);
                            }
                        }
                        else if (v !== undefined && v !== null) {
                            indexFn(id, p, v);
                        }
                    }
                }
            };

            that.events.onBeforeLoading.fire(that);

            try {
                n = items.length;
                chunk_size = parseInt(n / 100, 10);
                if (chunk_size > 200) {
                    chunk_size = 200;
                }
                if (chunk_size < 1) {
                    chunk_size = 1;
                }

                f = function(start) {
                    var end,
                    i;

                    end = start + chunk_size;
                    if (end > n) {
                        end = n;
                    }

                    try {
                        for (i = start; i < end; i += 1) {
                            entry = items[i];
                            if (typeof(entry) == "object") {
                                loadItem(entry);
                            }
                        }
                    }
                    catch(e) {
                        MITHGrid.debug("loadData failed: ", e);
                    }

                    if (end < n) {
                        setTimeout(function() {
                            f(end);
                        },
                        0);
                    }
                    else {
                        setTimeout(function() {
                            that.events.onAfterLoading.fire(that);
                            setTimeout(function() {
                                that.events.onModelChange.fire(that, id_list);
                            },
                            0);
                        },
                        0);
                    }
                };
                f(0);
            }
            catch(e) {
                MITHGrid.debug("loadData failed: ", e);
            }
        };

        that.prepare = function(expressions) {
            return $.map(expressions,
            function(ex) {
                return MITHGrid.ExpressionParser().parse(ex);
            });
        };

        that.evaluate = function(id, expressions) {
            var values = [];
            $.each(expressions,
            function(idx, ex) {
                var items = ex.evaluateOnItem(id, that);
                values = values.concat(items.values.items());
            });
            return values;
        };

        var indexFillSet = function(index, x, y, set, filter) {
            var hash = index[x],
            array,
            i,
            n,
            z;
            if (hash) {
                array = hash.values[y];
                if (array) {
                    if (filter) {
                        for (i = 0, n = array.length; i < n; i += 1) {
                            z = array[i];
                            if (filter.contains(z)) {
                                set.add(z);
                            }
                        }
                    }
                    else {
                        for (i = 0, n = array.length; i < n; i += 1) {
                            set.add(array[i]);
                        }
                    }
                }
            }
        };

        var getUnion = function(index, xSet, y, set, filter) {
            if (!set) {
                set = MITHGrid.Set();
            }

            xSet.visit(function(x) {
                indexFillSet(index, x, y, set, filter);
            });
            return set;
        };

        that.getObjectsUnion = function(subjects, p, set, filter) {
            return getUnion(that.spo, subjects, p, set, filter);
        };

        that.getSubjectsUnion = function(objects, p, set, filter) {
            return getUnion(that.ops, objects, p, set, filter);
        };


        return that;
    };

    var views = {};

    MITHGrid.DataView = function(options) {
        var that,
        set = MITHGrid.Set();

        if (typeof(views[options.label]) != "undefined") {
            return views[options.label];
        }

        that = fluid.initView("MITHGrid.DataView", $(window), options);

        that.registerFilter = function(ob) {
            that.events.onFilterItem.addListener(function(x, y) {
                return ob.eventFilterItem(x, y);
            });
            that.events.onModelChange.addListener(function(m, i) {
                ob.eventModelChange(m, i);
            });
            ob.events.onFilterChange.addListener(that.eventFilterChange);
        };

        that.registerView = function(ob) {
            that.events.onModelChange.addListener(function(m, i) {
                ob.eventModelChange(m, i);
            });
            that.filterItems(function() {
                ob.eventModelChange(that, that.items());
            });
        };

        that.items = set.items;
        that.size = set.size;

        that.filterItems = function(endFn) {
            var id,
            fres,
            ids,
            n,
            chunk_size,
            f;

            set = MITHGrid.Set();

            that.items = set.items;
            that.size = set.size;
            ids = that.dataSource.items();
            n = ids.length;
            if (n === 0) {
                endFn();
                return;
            }
            chunk_size = parseInt(n / 100, 10);
            if (chunk_size > 200) {
                chunk_size = 200;
            }
            if (chunk_size < 1) {
                chunk_size = 1;
            }

            f = function(start) {
                var i,
                end;
                end = start + chunk_size;
                if (end > n) {
                    end = n;
                }
                for (i = start; i < end; i += 1) {
                    id = ids[i];
                    free = that.events.onFilterItem.fire(that.dataSource, id);
                    if (free !== false) {
                        set.add(id);
                    }
                }
                if (end < n) {
                    setTimeout(function() {
                        f(end);
                    },
                    0);
                }
                else {
                    if (endFn) {
                        setTimeout(endFn, 0);
                    }
                }
            };
            f(0);
        };

        that.eventModelChange = function(model, items) {
            that.filterItems(function() {
                that.events.onModelChange.fire(that, items);
            });
        };

        that.eventFilterChange = that.eventModelChange;

        that.dataSource = MITHGrid.DataSource({
            source: options.source
        });

        that.getItems = that.dataSource.getItems;
        that.getItem = that.dataSource.getItem;
        that.updateItems = that.dataSource.updateItems;
        that.prepare = that.dataSource.prepare;
        that.evaluate = that.dataSource.evaluate;
        that.dataSource.events.onModelChange.addListener(that.eventModelChange);

        return that;
    };

    MITHGrid.Controls = {
        "if": {
            f: function(args, roots, rootValueTypes, defaultRootName, database) {
                var conditionCollection = args[0].evaluate(roots, rootValueTypes, defaultRootName, database),
                condition = false;
                conditionCollection.forEachValue(function(v) {
                    if (v) {
                        condition = true;
                        return true;
                    }
                });

                if (condition) {
                    return args[1].evaluate(roots, rootValueTypes, defaultRootName, database);
                }
                else {
                    return args[2].evaluate(roots, rootValueTypes, defaultRootName, database);
                }
            }
        },
        "foreach": {
            f: function(args, roots, rootValueTypes, defaultRootName, database) {
                var collection = args[0].evaluate(roots, rootValueTypes, defaultRootName, database),
                oldValue = roots.value,
                oldValueType = rootValueTypes.value,
                results = [],
                valueType = "text",
                collection2;

                rootValueTypes.value = collection.valueType;

                collection.forEachValue(function(element) {
                    roots.value = element;
                    collection2 = args[1].evaluate(roots, rootValueTypes, defaultRootName, database);
                    valueType = collection2.valueType;

                    collection2.forEachValue(function(result) {
                        results.push(result);
                    });
                });

                roots.value = oldValue;
                rootValueTypes.value = oldValueType;

                return MITHGrid.Expression.Collection(results, valueType);
            }
        },
        "default": {
            f: function(args, roots, rootValueTypes, defaultRootName, database) {
                var i,
                n,
                collection;
                for (i = 0, n = args.length; i < n; i++) {
                    collection = args[i].evaluate(roots, rootValueTypes, defaultRootName, database);
                    if (collection.size() > 0) {
                        return collection;
                    }
                }
                return MITHGrid.Expression.Collection([], "text");
            }
        }
    };

    MITHGrid.Expression = function(rootNode) {
        var that = {};

        that.evaluate = function(
        roots,
        rootValueTypes,
        defaultRootName,
        database
        ) {
            var collection = rootNode.evaluate(roots, rootValueTypes, defaultRootName, database);
            return {
                values: collection.getSet(),
                valueType: collection.valueType,
                size: collection.size()
            };
        };

        that.evaluateOnItem = function(itemID, database) {
            return this.evaluate(
            {
                "value": itemID
            },
            {
                "value": "item"
            },
            "value",
            database
            );
        };

        that.evaluateSingle = function(
        roots,
        rootValueTypes,
        defaultRootName,
        database
        ) {
            var collection = rootNode.evaluate(roots, rootValueTypes, defaultRootName, database),
            result = {
                value: null,
                valueType: collection.valueType
            };

            collection.forEachValue(function(v) {
                result.value = v;
                return true;
            });

            return result;
        };

        that.isPath = rootNode.isPath;

        that.getPath = that.isPath ?
        function() {
            return rootNode;
        }:
        function() {
            return null;
        };

        that.testExists = that.isPath ?
        function(
        roots,
        rootValueTypes,
        defaultRootName,
        database
        ) {
            return rootNode.testExists(roots, rootValueTypes, defaultRootName, database);
        }:
        function(
        roots,
        rootValueTypes,
        defaultRootName,
        database
        ) {
            return that.evaluate(roots, rootValueTypes, defaultRootName, database).values.size() > 0;
        };

        that.evaluateBackward = function(
        value,
        valueType,
        filter,
        database
        ) {
            return rootNode.walkBackward([value], valueType, filter, database);
        };

        that.walkForward = function(
        values,
        valueType,
        database
        ) {
            return rootNode.walkForward(values, valueType, database);
        };

        that.walkBackward = function(
        values,
        valueType,
        filter,
        database
        ) {
            return rootNode.walkBackward(values, valueType, filter, database);
        };

        return that;
    };

    MITHGrid.Expression.Collection = function(values, valueType) {
        var that = {
            valueType: valueType
        };

        if (values instanceof Array) {

            that.forEachValue = function(f) {
                var a = values,
                i,
                n;

                for (i = 0, n = a.length; i < n; i++) {
                    if (f(a[i]) === true) {
                        break;
                    }
                }
            };

            that.getSet = function() {
                return MITHGrid.Set(values);
            };

            that.contains = function(v) {
                var a = values,
                i,
                n;

                for (i = 0, n = a.length; i < n; i++) {
                    if (a[i] == v) {
                        return true;
                    }
                }
                return false;
            };

            that.size = function() {
                return values.length;
            };

        }
        else {

            that.forEachValue = function(f) {
                return values.visit(f);
            };

            that.getSet = function() {
                return values;
            };

            that.contains = function(v) {
                return values.contains(v);
            };

            that.size = values.size;

        }

        that.isPath = false;

        return that;
    };

    MITHGrid.Expression.Constant = function(value, valueType) {
        var that = {};

        that.evaluate = function(
        roots,
        rootValueTypes,
        defaultRootName,
        database
        ) {
            return MITHGrid.Expression.Collection([value], valueType);
        };

        that.isPath = false;

        return that;
    };

    var _operators = {
        "+": {
            argumentType: "number",
            valueType: "number",
            f: function(a, b) {
                return a + b;
            }
        },
        "-": {
            argumentType: "number",
            valueType: "number",
            f: function(a, b) {
                return a - b;
            }
        },
        "*": {
            argumentType: "number",
            valueType: "number",
            f: function(a, b) {
                return a * b;
            }
        },
        "/": {
            argumentType: "number",
            valueType: "number",
            f: function(a, b) {
                return a / b;
            }
        },
        "=": {
            valueType: "boolean",
            f: function(a, b) {
                return a == b;
            }
        },
        "<>": {
            valueType: "boolean",
            f: function(a, b) {
                return a != b;
            }
        },
        "><": {
            valueType: "boolean",
            f: function(a, b) {
                return a != b;
            }
        },
        "<": {
            valueType: "boolean",
            f: function(a, b) {
                return a < b;
            }
        },
        ">": {
            valueType: "boolean",
            f: function(a, b) {
                return a > b;
            }
        },
        "<=": {
            valueType: "boolean",
            f: function(a, b) {
                return a <= b;
            }
        },
        ">=": {
            valueType: "boolean",
            f: function(a, b) {
                return a >= b;
            }
        }
    };

    MITHGrid.Expression.Operator = function(operator, args) {
        var that = {},
        _operator = operator,
        _args = args;

        that.evaluate = function(
        roots,
        rootValueTypes,
        defaultRootName,
        database
        ) {
            var values = [],
            args = [],
            i,
            n,
            operator,
            f;

            for (i = 0, n = _args.length; i < n; i++) {
                args.push(_args[i].evaluate(roots, rootValueTypes, defaultRootName, database));
            }

            operator = _operators[_operator];
            f = operator.f;
            if (operator.argumentType == "number") {
                args[0].forEachValue(function(v1) {
                    if (typeof(v1) != "number") {
                        v1 = parseFloat(v1);
                    }

                    args[1].forEachValue(function(v2) {
                        if (typeof(v2) != "number") {
                            v2 = parseFloat(v2);
                        }

                        values.push(f(v1, v2));
                    });
                });
            }
            else {
                args[0].forEachValue(function(v1) {
                    args[1].forEachValue(function(v2) {
                        values.push(f(v1, v2));
                    });
                });
            }

            return MITHGrid.Expression.Collection(values, operator.valueType);
        };

        that.isPath = false;

        return that;
    };

    MITHGrid.Expression.FunctionCall = function(name, args) {
        var that = {},
        _name = name,
        _args = args;

        that.evaluate = function(
        roots,
        rootValueTypes,
        defaultRootName,
        database
        ) {
            var args = [],
            i,
            n;

            for (i = 0, n = _args.length; i < n; i++) {
                args.push(_args[i].evaluate(roots, rootValueTypes, defaultRootName, database));
            }

            if (_name in MITHGrid.Functions) {
                return MITHGrid.Functions[_name].f(args);
            }
            else {
                throw new Error("No such function named " + _name);
            }
        };

        that.isPath = false;

        return that;
    };

    MITHGrid.Expression.ControlCall = function(name, args) {
        var that = {},
        _name = name,
        _args = args;

        that.evaluate = function(
        roots,
        rootValueTypes,
        defaultRootName,
        database
        ) {
            return MITHGrid.Controls[_name].f(_args, roots, rootValueTypes, defaultRootName, database);
        };

        that.isPath = false;

        return that;
    };

    MITHGrid.Expression.Path = function(property, forward) {
        var that = {},
        _rootName = null,
        _segments = [];

        if (typeof(property) != "undefined") {
            _segments.push({
                property: property,
                forward: forward,
                isArray: false
            });
        }

        that.isPath = true;

        that.setRootName = function(rootName) {
            _rootName = rootName;
        };

        that.appendSegment = function(property, hopOperator) {
            _segments.push({
                property: property,
                forward: hopOperator.charAt(0) == ".",
                isArray: hopOperator.length > 1
            });
        };

        that.getSegment = function(index) {
            var segment;

            if (index < _segments.length) {
                segment = _segments[index];
                return {
                    property: segment.property,
                    forward: segment.forward,
                    isArray: segment.isArray
                };
            }
            else {
                return null;
            }
        };

        that.getLastSegment = function() {
            return that.getSegment(_segments.length - 1);
        };

        that.getSegmentCount = function() {
            return _segments.length;
        };

        var walkForward = function(collection, database) {
            var i,
            n,
            segment,
            a,
            valueType,
            property,
            values;

            for (i = 0, n = _segments.length; i < n; i++) {
                segment = _segments[i];
                if (segment.isArray) {
                    a = [];
                    if (segment.forward) {
                        collection.forEachValue(function(v) {
                            database.getObjects(v, segment.property).visit(function(v2) {
                                a.push(v2);
                            });
                        });

                        property = database.getProperty(segment.property);
                        valueType = property !== null ? property.getValueType() : "text";
                    }
                    else {
                        collection.forEachValue(function(v) {
                            database.getSubjects(v, segment.property).visit(function(v2) {
                                a.push(v2);
                            });
                        });
                        valueType = "item";
                    }
                    collection = MITHGrid.Expression.Collection(a, valueType);
                }
                else {
                    if (segment.forward) {
                        values = database.getObjectsUnion(collection.getSet(), segment.property);
                        property = database.getProperty(segment.property);
                        valueType = property !== null ? property.getValueType() : "text";
                        collection = MITHGrid.Expression.Collection(values, valueType);
                    }
                    else {
                        values = database.getSubjectsUnion(collection.getSet(), segment.property);
                        collection = MITHGrid.Expression.Collection(values, "item");
                    }
                }
            }

            return collection;
        };

        var walkBackward = function(collection, filter, database) {
            var i,
            segment,
            a,
            valueType,
            property,
            values;

            if (filter instanceof Array) {
                filter = MITHGrid.Set(filter);
            }
            for (i = _segments.length - 1; i >= 0; i--) {
                segment = _segments[i];
                if (segment.isArray) {
                    a = [];
                    if (segment.forward) {
                        collection.forEachValue(function(v) {
                            database.getSubjects(v, segment.property).visit(function(v2) {
                                if (i > 0 || filter === null || filter.contains(v2)) {
                                    a.push(v2);
                                }
                            });
                        });

                        property = database.getProperty(segment.property);
                        valueType = property !== null ? property.getValueType() : "text";
                    }
                    else {
                        collection.forEachValue(function(v) {
                            database.getObjects(v, segment.property).visit(function(v2) {
                                if (i > 0 || filter === null || filter.contains(v2)) {
                                    a.push(v2);
                                }
                            });
                        });
                        valueType = "item";
                    }
                    collection = MITHGrid.Expression.Collection(a, valueType);
                }
                else {
                    if (segment.forward) {
                        values = database.getSubjectsUnion(collection.getSet(), segment.property, null, i === 0 ? filter: null);
                        collection = MITHGrid.Expression.Collection(values, "item");
                    }
                    else {
                        values = database.getObjectsUnion(collection.getSet(), segment.property, null, i === 0 ? filter: null);
                        property = database.getProperty(segment.property);
                        valueType = property !== null ? property.getValueType() : "text";
                        collection = MITHGrid.Expression.Collection(values, valueType);
                    }
                }
            }

            return collection;
        };

        that.rangeBackward = function(
        from,
        to,
        filter,
        database
        ) {
            var set = MITHGrid.Set(),
            valueType = "item",
            segment,
            i;

            if (_segments.length > 0) {
                segment = _segments[_segments.length - 1];
                if (segment.forward) {
                    database.getSubjectsInRange(segment.property, from, to, false, set, _segments.length == 1 ? filter: null);
                }
                else {
                    throw new Error("Last path of segment must be forward");
                }

                for (i = _segments.length - 2; i >= 0; i--) {
                    segment = _segments[i];
                    if (segment.forward) {
                        set = database.getSubjectsUnion(set, segment.property, null, i === 0 ? filter: null);
                        valueType = "item";
                    }
                    else {
                        set = database.getObjectsUnion(set, segment.property, null, i === 0 ? filter: null);
                        property = database.getProperty(segment.property);
                        valueType = property !== null ? property.getValueType() : "text";
                    }
                }
            }

            return {
                valueType: valueType,
                values: set,
                count: set.size()
            };
        };

        that.evaluate = function(
        roots,
        rootValueTypes,
        defaultRootName,
        database
        ) {
            var rootName = _rootName !== null ? _rootName: defaultRootName,
            valueType = rootName in rootValueTypes ? rootValueTypes[rootName] : "text",
            collection = null,
            root;

            if (rootName in roots) {
                root = roots[rootName];

                if (root.isSet || root instanceof Array) {
                    collection = MITHGrid.Expression.Collection(root, valueType);
                }
                else {
                    collection = MITHGrid.Expression.Collection([root], valueType);
                }

                return walkForward(collection, database);
            }
            else {
                throw new Error("No such variable called " + rootName);
            }
        };

        that.testExists = function(
        roots,
        rootValueTypes,
        defaultRootName,
        database
        ) {
            return that.evaluate(roots, rootValueTypes, defaultRootName, database).size() > 0;
        };

        that.evaluateBackward = function(
        value,
        valueType,
        filter,
        database
        ) {
            var collection = MITHGrid.Expression.Collection([value], valueType);
            return walkBackward(collection, filter, database);
        };

        that.walkForward = function(
        values,
        valueType,
        database
        ) {
            return walkForward(MITHGrid.Expression.Collection(values, valueType), database);
        };

        that.walkBackward = function(
        values,
        valueType,
        filter,
        database
        ) {
            return walkBackward(MITHGrid.Expression.Collection(values, valueType), filter, database);
        };

        return that;
    };

    MITHGrid.ExpressionParser = function() {
        var that = {};

        var internalParse = function(scanner, several) {
            var token = scanner.token(),
            roots,
            expressions,
            r,
            n,
            Scanner = MITHGrid.ExpressionScanner,
            next = function() {
                scanner.next();
                token = scanner.token();
            },
            makePosition = function() {
                return token !== null ? token.start: scanner.index();
            };

            var parsePath = function() {
                var path = MITHGrid.Expression.Path(),
                hopOperator;
                while (token !== null && token.type == Scanner.PATH_OPERATOR) {
                    hopOperator = token.value;
                    next();

                    if (token !== null && token.type == Scanner.IDENTIFIER) {
                        path.appendSegment(token.value, hopOperator);
                        next();
                    }
                    else {
                        throw new Error("Missing property ID at position " + makePosition());
                    }
                }
                return path;
            };

            var parseFactor = function() {
                var result = null,
                identifier;

                if (token === null) {
                    throw new Error("Missing factor at end of expression");
                }

                switch (token.type) {
                case Scanner.NUMBER:
                    result = MITHGrid.Expression.Constant(token.value, "number");
                    next();
                    break;
                case Scanner.STRING:
                    result = MITHGrid.Expression.Constant(token.value, "text");
                    next();
                    break;
                case Scanner.PATH_OPERATOR:
                    result = parsePath();
                    break;
                case Scanner.IDENTIFIER:
                    identifier = token.value;
                    next();

                    if (identifier in MITHGrid.Controls) {
                        if (token !== null && token.type == Scanner.DELIMITER && token.value == "(") {
                            next();

                            args = (token !== null && token.type == Scanner.DELIMITER && token.value == ")") ?
                            [] : parseExpressionList();
                            result = MITHGrid.Expression.ControlCall(identifier, args);

                            if (token !== null && token.type == Scanner.DELIMITER && token.value == ")") {
                                next();
                            }
                            else {
                                throw new Error("Missing ) to end " + identifier + " at position " + makePosition());
                            }
                        }
                        else {
                            throw new Error("Missing ( to start " + identifier + " at position " + makePosition());
                        }
                    }
                    else {
                        if (token !== null && token.type == Scanner.DELIMITER && token.value == "(") {
                            next();

                            args = (token !== null && token.type == Scanner.DELIMITER && token.value == ")") ?
                            [] : parseExpressionList();
                            result = MITHGrid.Expression.FunctionCall(identifier, args);

                            if (token !== null && token.type == Scanner.DELIMITER && token.value == ")") {
                                next();
                            }
                            else {
                                throw new Error("Missing ) after function call " + identifier + " at position " + makePosition());
                            }
                        }
                        else {
                            result = parsePath();
                            result.setRootName(identifier);
                        }
                    }
                    break;
                case Scanner.DELIMITER:
                    if (token.value == "(") {
                        next();

                        result = parseExpression();
                        if (token !== null && token.type == Scanner.DELIMITER && token.value == ")") {
                            next();
                            break;
                        }
                        else {
                            throw new Error("Missing ) at position " + makePosition());
                        }
                    }
					else {
						throw new Error("Unexpected text " + token.value + " at position " + makePosition());
					}
					break;
                default:
                    throw new Error("Unexpected text " + token.value + " at position " + makePosition());
                }

                return result;
            };

            var parseTerm = function() {
                var term = parseFactor(),
                operator;

                while (token !== null && token.type == Scanner.OPERATOR &&
                (token.value == "*" || token.value == "/")) {
                    operator = token.value;
                    next();

                    term = MITHGrid.Expression.Operator(operator, [term, parseFactor()]);
                }
                return term;
            };

            var parseSubExpression = function() {
                var subExpression = parseTerm(),
                operator;

                while (token !== null && token.type == Scanner.OPERATOR &&
                (token.value == "+" || token.value == "-")) {
                    operator = token.value;
                    next();

                    subExpression = MITHGrid.Expression.Operator(operator, [subExpression, parseTerm()]);
                }
                return subExpression;
            };

            var parseExpression = function() {
                var expression = parseSubExpression(),
                operator;

                while (token !== null && token.type == Scanner.OPERATOR &&
                (token.value == "=" || token.value == "<>" ||
                token.value == "<" || token.value == "<=" ||
                token.value == ">" || token.value == ">=")) {

                    operator = token.value;
                    next();

                    expression = MITHGrid.Expression.Operator(operator, [expression, parseSubExpression]);
                }
                return expression;
            };

            var parseExpressionList = function() {
                var expressions = [parseExpression()];
                while (token !== null && token.type == Scanner.DELIMITER && token.value == ",") {
                    next();
                    expressions.push(parseExpression());
                }
                return expressions;
            };

            if (several) {
                roots = parseExpressionList();
                expressions = [];
                for (r = 0, n = roots.length; r < n; r++) {
                    expressions.push(MITHGrid.Expression(roots[r]));
                }
                return expressions;
            }
            else {
                return MITHGrid.Expression(parseExpression());
            }
        };

        that.parse = function(s, startIndex, results) {
            var scanner;

            startIndex = startIndex || 0;
            results = results || {};

            scanner = MITHGrid.ExpressionScanner(s, startIndex);
            try {
                return internalParse(scanner, false);
            }
            finally {
                results.index = scanner.token() !== null ? scanner.token().start: scanner.index();
            }
        };

        return that;
    };

    MITHGrid.ExpressionScanner = function(text, startIndex) {
        var that = {},
        _text = text + " ",
        _maxIndex = text.length,
        _index = startIndex,
        _token = null;

        that.token = function() {
            return _token;
        };

        that.index = function() {
            return _index;
        };

        var isDigit = function(c) {
            return "0123456789".indexOf(c) >= 0;
        };

        that.next = function() {
            var c1,
            c2,
            i,
            c;

            _token = null;

            while (_index < _maxIndex &&
            " \t\r\n".indexOf(_text.charAt(_index)) >= 0) {
                _index++;
            }

            if (_index < _maxIndex) {
                c1 = _text.charAt(_index);
                c2 = _text.charAt(_index + 1);

                if (".!".indexOf(c1) >= 0) {
                    if (c2 == "@") {
                        _token = {
                            type: MITHGrid.ExpressionScanner.PATH_OPERATOR,
                            value: c1 + c2,
                            start: _index,
                            end: _index + 2
                        };
                        _index += 2;
                    }
                    else {
                        _token = {
                            type: MITHGrid.ExpressionScanner.PATH_OPERATOR,
                            value: c1,
                            start: _index,
                            end: _index + 1
                        };
                        _index += 1;
                    }
                }
                else if ("<>".indexOf(c1) >= 0) {
                    if ((c2 == "=") || ("<>".indexOf(c2) >= 0 && c1 != c2)) {
                        _token = {
                            type: MITHGrid.ExpressionScanner.OPERATOR,
                            value: c1 + c2,
                            start: _index,
                            end: _index + 2
                        };
                        _index += 2;
                    }
                    else {
                        _token = {
                            type: MITHGrid.ExpressionScanner.OPERATOR,
                            value: c1,
                            start: _index,
                            end: _index + 1
                        };
                        _index += 1;
                    }
                }
                else if ("+-*/=".indexOf(c1) >= 0) {
                    _token = {
                        type: MITHGrid.ExpressionScanner.OPERATOR,
                        value: c1,
                        start: _index,
                        end: _index + 1
                    };
                    _index += 1;
                }
                else if ("()".indexOf(c1) >= 0) {
                    _token = {
                        type: MITHGrid.ExpressionScanner.DELIMITER,
                        value: c1,
                        start: _index,
                        end: _index + 1
                    };
                    _index += 1;
                }
                else if ("\"'".indexOf(c1) >= 0) {
                    // quoted strings
                    i = _index + 1;
                    while (i < _maxIndex) {
                        if (_text.charAt(i) == c1 && _text.charAt(i - 1) != "\\") {
                            break;
                        }
                        i += 1;
                    }

                    if (i < _maxIndex) {
                        _token = {
                            type: MITHGrid.ExpressionScanner.STRING,
                            value: _text.substring(_index + 1, i).replace(/\\'/g, "'").replace(/\\"/g, '"'),
                            start: _index,
                            end: i + 1
                        };
                        _index = i + 1;
                    }
                    else {
                        throw new Error("Unterminated string starting at " + _index);
                    }
                }
                else if (isDigit(c1)) {
                    // number
                    i = _index;
                    while (i < _maxIndex && isDigit(_text.charAt(i))) {
                        i += 1;
                    }

                    if (i < _maxIndex && _text.charAt(i) == ".") {
                        i += 1;
                        while (i < _maxIndex && isDigit(_text.charAt(i))) {
                            i += 1;
                        }
                    }

                    _token = {
                        type: MITHGrid.ExpressionScanner.NUMBER,
                        value: parseFloat(_text.substring(_index, i)),
                        start: _index,
                        end: i
                    };

                    _index = i;
                }
                else {
                    // identifier
                    i = _index;

                    while (i < _maxIndex) {
                        c = _text.charAt(i);
                        if ("(),.!@ \t".indexOf(c) < 0) {
                            i += 1;
                        }
                        else {
                            break;
                        }
                    }

                    _token = {
                        type: MITHGrid.ExpressionScanner.IDENTIFIER,
                        value: _text.substring(_index, i),
                        start: _index,
                        end: i
                    };
                    _index = i;
                }
            }
        };

        that.next();

        return that;
    };

    MITHGrid.ExpressionScanner.DELIMITER = 0;
    MITHGrid.ExpressionScanner.NUMBER = 1;
    MITHGrid.ExpressionScanner.STRING = 2;
    MITHGrid.ExpressionScanner.IDENTIFIER = 3;
    MITHGrid.ExpressionScanner.OPERATOR = 4;
    MITHGrid.ExpressionScanner.PATH_OPERATOR = 5;



	MITHGrid.namespace('Presentation');
    
	MITHGrid.Presentation.initView = function(type, container, options) {
		var that = fluid.initView("MITHGrid.Presentation." + type, container, options),
		    renderings = { };		
		options = that.options;
		
		$(container).empty();
		
//		$("<div id='" + my_id + "-body'></div>").appendTo($(container));
//		that.body_container = $('#' + my_id + '-body');
		
		that.eventModelChange = function(model, items) {
			var n;
			//$(container).empty();
						
			// we need to know if items are gone or added or changed
			// if the item id is no longer in the model, then it was removed
			// if the item is in the model but not in the renderings object, then it was added
			// otherwise, it was changed
			that.renderItems(model, items);
		};
		
		that.renderingFor = function(id) {
			return renderings[id];
		};
		
		that.renderItems = function(model, items) {
			n = items.length;
			var f = function(start) {
				var end, i;
				if(start < n) {
					end = n;
					if(n > 200) {
						end = start + parseInt(Math.sqrt(n), 10) + 1;
						if(end > n) {
							end = n;
						}
					}
					for(i = start; i < end; i += 1) {
						var id = items[i];
						item = model.getItem(id);
						if(!item) {
							// item was removed
							if(renderings[id]) {
								// we need to remove it from the display
							    // .remove() should not make changes in the model
								renderings[id].remove();
							}
						}
						else if(renderings[id]) {
							renderings[id].update(item);
						}
						else {
						    lens = that.getLens(item);
							if(lens) {
								renderings[id] = lens.render(container, that, model, items[i]);
							}
						}
					}
					
					that.finishDisplayUpdate();
					setTimeout(function() {
						f(end);
					}, 0);
				}
			};
			that.startDisplayUpdate();
			f(0);
		};
		
		that.startDisplayUpdate = function() { 
			$(container).empty();
		};
		
		that.finishDisplayUpdate = function() {
			$("<div class='clear'></div>").appendTo($(container));
		};
		
		that.selfRender = function() {
			/* do nothing -- needs to be implemented in subclass */
			that.startDisplayUpdate();
			that.renderItems(that.options.source, that.options.source.items());
			that.finishDisplayUpdate();
		};
		
		that.dataView = that.options.source;
		that.options.source.registerView(that);
		return that;
	};

    MITHGrid.Application = function(options) {
        var that = {
            presentation: {},
            dataSource: {},
            dataView: {}
        };

		var onReady = [ ];
		
		that.ready = function(fn) {
			onReady.push(fn);
		};
		

        if ('dataSources' in options) {
            $.each(options.dataSources,
            function(idx, config) {
                var store = MITHGrid.DataSource({
                    source: config.label
                });
                that.dataSource[config.label] = store;
                store.addType('Item');
                store.addProperty('label', {
                    valueType: 'text'
                });
                store.addProperty('type', {
                    valueType: 'text'
                });
                store.addProperty('id', {
                    valueType: 'text'
                });
                if ('types' in config) {
                    $.each(config.types,
                    function(idx, type) {
                        store.addType(type.label);
                    });
                }
                if ('properties' in config) {
                    $.each(config.properties,
                    function(idx, property) {
                        store.addProperty(property.label, property);
                    });
                }
            });
        }

        if ('dataViews' in options) {
            $.each(options.dataViews,
            function(idx, config) {
                var view = MITHGrid.DataView({
                    source: config.dataSource,
                    label: config.label
                });
                that.dataView[config.label] = view;
            });
        }

        if ('presentations' in options) {
            that.ready(function() {
                $.each(options.presentations,
                function(idx, config) {
                    var options = $.extend(true, {},
                    config.options);
                    var container = $(config.container);
                    if ($.isArray(container)) {
                        container = container[0];
                    }
                    options.source = that.dataView[config.dataView];

                    var presentation = config.type(container, options);
                    that.presentation[config.label] = presentation;
                    presentation.selfRender();
                });
            });
        }

		$(document).ready(function() {
			$.each(onReady, function(idx, fn) {
				fn();
			});
			that.ready = function(fn) { setTimeout(fn, 0); };
		});

        return that;
    };

})(jQuery, MITHGrid);

fluid.defaults("MITHGrid.DataSource", {
    events: {
        onModelChange: null,
        onBeforeLoading: null,
        onAfterLoading: null,
        onBeforeUpdating: null,
        onAfterUpdating: null
    }
});

fluid.defaults("MITHGrid.DataView", {
    events: {
        onModelChange: null,
        onFilterItem: "preventable"
    }
});