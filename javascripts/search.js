Search = function() {
  this.lookupQueue_ = [];
}

Search.prototype.cache_ = {};

Search.prototype.addLookup = function(key, method) {
  if (this.cache[[key, method]]) {
    return this.cache[[key, method]].deferred;
  }
  var entry = {key: key, method: method, deferred: new goog.async.Deferred()};
  this.cache[[key, method]] = entry;
  this.lookupQueue_.push(entry);
  return entry.deferred;
}

Search.prototype.run = function() {
  var allDeferreds = [];
  var lookupsByMethod = {};
  goog.array.forEach(this.lookupQueue_, function(entry) {
    lookupsByMethod[entry.method] = lookupsByMethod[entry.method] || [];
    lookupsByMethod[entry.method].push(entry);
    allDeferreds.push(entry.deferred);
  }, this);
  this.lookupQueue_ = [];
  this.searchNames(lookupsByMethod['names']);
  // Run 3 queries at once.
  var entryList = lookupsByMethod['nominatim'];
  for (var i=0; i<3 && entryList.length; i++) {
    this.searchNominatim(entryList);
  }
  return DeferredList.gatherResults(allDeferreds);
};


Search.prototype.searchNominatim = function(entryList) {
  var firstEntry = entryList.pop();
  runSearch(firstEntry.key, function(result) {
    firstEntry.deferred.callback(result);
    this.searchNominatim(entryList);
  }, function(error) { firstEntry.deferred.errback(error); });
};
