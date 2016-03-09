var hostnames = [];
var tabHostnames = {};
var blCache = {};
var blReports = {};
var blRules = {};

chrome.tabs.query({}, function(results){
  for(var i in results){
    var tab = results[i];
    handlePageAction(tab);
  }
});

chrome.storage.sync.get(function(){});

chrome.tabs.onUpdated.addListener(function(tabId, info, tab){
  if( info.status === "loading" ) {
    handlePageAction(tab);
  }
});

chrome.tabs.onUpdated.addListener(function(tabId, info, tab){
  if( info.url || info.status === "loading"){
    var url = new URL(tab.url);
    var hostname = url.hostname;
    if( url.protocol !== "http:" && url.protocol !== "https:" ){
      return;
    }
    tabHostnames[tabId] = hostname;
    blReports[tabId] = [];
    var patterns = getPatternsForHostname(hostname);
    for(var i in patterns){
      var cache = function(pattern){
        var key = 'bl_'+pattern;
        chrome.storage.sync.get(key, function(data){
          console.log('GOT', key, data);
          blCache[pattern] = data[key];
        });
      };

      cache(patterns[i]);
    }
  }
});

chrome.webRequest.onBeforeRequest.addListener(function(details){
  var tabId = details.tabId;
  var report;
  //console.log(details);
  if(details.tabId != -1){
    var blackList = [];
    var blackLists = {};
    var hostname = tabHostnames[details.tabId];
    if(hostname == null){
      return;
    }
    targetUrl = new URL(details.url);
    targetSectors = targetUrl.hostname.split(".").reverse();
    patterns = getPatternsForHostname(hostname);
    for (var i in patterns){
      var pattern = patterns[i];
      blackList = blCache[pattern];
      //console.log("BL", pattern, blackList);
      for (var i in blackList){
        var match = urlsMatch(blackList[i], targetSectors);
        //console.log("MATCH", match, blackList[i], targetUrl.hostname);
        if(match){
          report = {
            command: "report_bl",
            hostname: targetUrl.hostname,
            targetHostname: targetUrl.hostname,
            blockedByPattern: pattern,
            blockedPattern: blackList[i],
            status: 'block',
            tabId: details.tabId,
          };
          console.log("BLOCK", report);
          blReports[tabId].push(report);
          chrome.runtime.sendMessage(report);
          return {cancel: true};
        }
      }
    }
    //console.log("ALLOW", targetUrl.hostname);
    report = {
      command: "report_bl",
      hostname: targetUrl.hostname,
      targetHostname: targetUrl.hostname,
      status: 'pass',
      tabId: details.tabId,
    };
    blReports[tabId].push(report);
    chrome.runtime.sendMessage(report);
    return;
  }
}, {
  urls: ["<all_urls>"]
}, ["blocking"]);

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
  var command = message.command;
  if(command == "get_bulk_reports"){
    sendResponse({
      data: blReports[message.tabId],
    });
  }
  else if(command === 'add_rule'){
    if(blCache[message.from]==null){
      blCache[message.from] = [];
    }
    var rules = blCache[message.from];
    if(message.action === 'block'){
      rules.push(message.to);
      sync(message.from);
      console.log("ADD", message);
    }

    console.log(message.from, blCache[message.from]);

    sendResponse({
      status: 'success',
    });
  }
  else if(command === 'remove_rule'){
    if(blCache[message.from] == null){
      sendResponse({
        status: 'error',
      });
    }
    else if(blCache[message.from] instanceof Array){
      var rules = blCache[message.from];
      rules.splice(rules.indexOf(message.to), 1);
      sync(message.from);
      sendResponse({
        'status': 'success',
      });
    }
  }
});

function urlsMatch(pattern, url){
  var matchParts = [];
  if(typeof pattern == "string"){
    pattern = pattern.split(".").reverse();
  }
  if(typeof url == "string"){
    url = url.split(".").reverse();
  }
  for (var i in pattern){
    var sector1 = pattern[i];
    var sector2 = url[i];
    if(sector1 === "*"){
      matchParts.push(sector1);
      return true;
    }
    else if(sector1 === sector2){
      matchParts.push(sector1);
      continue;
    }
    else{
      return false;
    }
  }
  return true;
}

function getPatternsForHostname(hostname){
  var out = [hostname];
  var sectors = hostname.split('.');
  for (var i=0; i<sectors.length; i++){
    var patt = [].concat.call("*", sectors.slice(i+1)).join(".");
    out.push(patt);
  }
  return out;
}

function handlePageAction(tab){
  var protocol = new URL(tab.url).protocol;
  if( protocol === "http:" || protocol === "https:" ){
    chrome.pageAction.show(tab.id);
  }
  else{
    chrome.pageAction.hide(tab.id);
  }
}

function sync(hostname){
  var key = 'bl_'+hostname;
  var obj = {};
  obj[key] = blCache[hostname]
  chrome.storage.sync.set(obj);
  chrome.storage.sync.get(key, function(data){
    console.log('SYNCED', data);
  });
}