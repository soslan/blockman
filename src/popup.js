requestedHostnames = {};
newRuleElements = {};
blockedEntries = {};
allowedEntries = {};
entries = {};
var currentHostname;

document.addEventListener('DOMContentLoaded', function(){
  advanced = document.querySelector('#advanced-wrap');
  query('#close-button', {
    action: function(){
      advanced.style.display = "none";
    }
  });
});

thisTab(function(tab){
  var url = new URL(tab.url);
  var hostname = url.hostname;
  currentHostname = hostname;
  var title = document.querySelector("#hostname");

  title.innerHTML = hostname;


  chrome.runtime.sendMessage({
    command: 'get_bulk_reports',
    tabId: tab.id,
  }, function(response){
    for (var i in response.data){
      var report = response.data[i];
      applyReport(report);
    }
  });
});

function applyReport(report){
  if(newRuleElements[report.hostname] == null){
    //newRuleElement(report);
  }
  if(entries[report.hostname] == null){
    addEntry(report);
  }
  
  if(report.status == 'block' && blockedEntries[report.hostname] == null){
    //allowedElement(report);
  }
  else if(report.status == 'pass' && blockedEntries[report.hostname] == null){
    //allowedElement(report);
  }
}

function blockedElement(report){
  var elem = entry({
    class: 'blocked',
    parent: '#requests',
  });

  span({
    class: 'entry-name',
    parent: elem.button,
    content: report.hostname,
  });

  span({
    parent: elem.button,
    content: 'blocked',
    classes: 'ctl blocked',
  });

  unblockButton = div({
    class: 'btn',
    parent: elem.controls,
    content: 'Unblock',
    action: function(){
      console.log(report);
      chrome.runtime.sendMessage({
        command: 'remove_rule',
        from: report.blockedByPattern,
        to: report.blockedPattern,
      });
    },
  })

  blockedEntries[report.hostname] = elem;
}

function addEntry(report){
  var elem = entry({
    parent: '#requests',
    action: function(){
      var advanced = document.querySelector("#advanced");
      advanced.innerHTML = "";

      console.log(report);
      div({
        content: 'From:',
        parent: advanced,
      });
      var fromDD = dropdown({
        value: currentHostname,
        options: getPatternsForHostname(currentHostname),
        parent: advanced,
      });
      div({
        content: 'To:',
        parent: advanced,
      });
      var toDD = dropdown({
        value: report.targetHostname,
        options: getPatternsForHostname(report.targetHostname),
        parent: advanced,
      });
      div({
        content: 'Do:',
        parent: advanced,
      });
      segmented({
        parent: advanced,
        options: {
          block: "Block",
          //allow: "Allow",
          'default': "Default",
        },
        value: report.status === "block" ? "block" : "default",
        onchange: function(val){
          console.log("onchange", val);
          if(val === "block"){
            chrome.runtime.sendMessage({
              command: 'add_rule',
              action: 'block',
              what: 'all',
              from: fromDD.val,
              to: toDD.val,
            });
          }
          else if(val === "default"){
            console.log("SENDING MESSAGE");
            chrome.runtime.sendMessage({
              command: 'remove_rule',
              from: fromDD.val,
              to: toDD.val,
            });
          }
        },
      })

      advanced.parentNode.style.display = 'block';
    }
  });
  span({
    class: 'entry-name',
    parent: elem.button,
    content: report.hostname,
  });

  var status = span({
    parent: elem.button,
    classes: 'ctl',
  });

  if(report.status === "block"){
    status.textContent = "blocked";
    status.classList.add('blocked');
  }
  else{
    status.textContent = "allowed";
    status.classList.add("allowed");
  }

  entries[report.hostname] = elem;
}

function allowedElement(report){
  var elem = entry({
    class: 'allowed',
    parent: '#requests',
    action: function(){
      var advanced = document.querySelector("#advanced");
      advanced.innerHTML = "";

      console.log(report);

      // var fromDD = dropdown({
      //   value: currentHostname,
      //   options: getPatternsForHostname(currentHostname),
      //   parent: advanced,
      // });

      // var toDD = dropdown({
      //   value: currentHostname,
      //   options: getPatternsForHostname(currentHostname),
      //   parent: advanced,
      // });
    }
  });

  span({
    class: 'entry-name',
    parent: elem.button,
    content: report.hostname,
  });

  span({
    parent: elem.button,
    content: 'allowed',
    classes: 'ctl allowed',
  });

  blockedEntries[report.hostname] = elem;
}


function newRuleElement(report){
  var elem = entry({
    class: 'new-rule-entry',
    parent: '#new',
  });
  var name = span({
    class: 'entry-name',
    content: report.hostname,
    parent: elem.button
  });

  div({
    content: 'Block this hostname:',
    parent: elem.controls,
  });

  var targetDD = dropdown({
    value: report.hostname,
    options: getPatternsForHostname(report.hostname),
    parent: elem.controls,
  });

  div({
    content: 'On this hostname:',
    parent: elem.controls,
  });

  var fromDD = dropdown({
    value: currentHostname,
    options: getPatternsForHostname(currentHostname),
    parent: elem.controls,
  });

  var save = div({
    class: 'btn btn-save',
    parent: elem.controls,
    content: 'Save',
    action: function(){
      console.log("TODD", targetDD.val);
      save.innerHTML = 'Saving...';
      chrome.runtime.sendMessage({
        command: 'add_rule',
        action: 'block',
        what: 'all',
        from: fromDD.val,
        to: targetDD.val,
      }, function(response){
        save.innerHTML = 'Save';
        console.log(response);
      });
    }
  });

  newRuleElements[report.hostname] = elem;
  return elem;
}

chrome.runtime.onMessage.addListener(function(message){
  if (message.command === 'report_bl'){
    thisTab(function(tab){
      if(message.tabId === tab.id){
        applyReport(message);
      }
    });
  }
});

function getPatternsForHostname(hostname){
  var out = [hostname];
  var sectors = hostname.split('.');
  for (var i=0; i<sectors.length; i++){
    var patt = [].concat.call("*", sectors.slice(i+1)).join(".");
    out.push(patt);
  }
  return out;
}

function thisTab(callback){
  chrome.tabs.query({
    currentWindow: true,
    active: true
  }, function(tabs){
    callback(tabs[0]);
  });
}


function entry(args){
  var elem = div(args);
  apply(elem, {
    class: 'entry-wrap',
  });
  var button = div({
    parent: elem,
    class: 'entry entry-button'
  });
  elem.button = button;
  return elem;
}

function entry2(args){
  var elem = div(args);
  apply(elem, {
    class: 'entry-wrap',
    action: function(e){
      toggle();
      e.stopPropagation();
      e.preventDefault();
    }
  });
  var button = div({
    parent: elem,
    class: 'entry entry-button'
  });
  var more = span({
    class: 'more',
    parent: button,
  });
  var expanded = false;
  var controls = div({
    class: 'entry-controls',
    parent: elem,
  });

  var toggle = function(){
    if(expanded){
      expanded = false;
      controls.classList.remove('expanded');
      button.classList.remove('active');
      more.classList.remove('fold');
    }
    else{
      expanded = true;
      controls.classList.add('expanded');
      button.classList.add('active');
      more.classList.add('fold');
    }
  };
  elem.button = button;
  elem.controls = controls;
  return elem;
}

function dropdown(args){
  var elem = div(args);
  var expanded = false;
  apply(elem, {
    class: 'dd dropdown',
    attributes: {
      tabindex: -1,
    },
    action: function(e){
      toggle();
      e.stopPropagation();
      e.preventDefault();
    },
    listeners: {
      blur: function(e){
        fold();
      }
    }
  });

  var current = span({
    class: 'dd-current-value',
    parent: elem,
    content: args.value || '',
  });

  elem.val = args.value || '';

  var more = span({
    class: 'more',
    parent: elem,
  });

  var options = div({
    class: 'dd-options',
    parent: elem,
  });

  var addOption = function(val){
    div({
      class: 'dd-option',
      parent: options,
      content: val,
      action: function(e){
        current.innerHTML = val;
        elem.val = val;
        toggle();
        e.stopPropagation();
        e.preventDefault();
      }
    });
  }

  for (var i in args.options){
    addOption(args.options[i]);
  }

  var toggle = function(){
    if(expanded){
      elem.classList.remove('active');
      more.classList.remove('fold');
      expanded = false;
    }
    else{
      elem.classList.add('active');
      more.classList.add('fold');
      expanded = true;
    }
  }

  var fold = function(){
      elem.classList.remove('active');
      more.classList.remove('fold');
      expanded = false;
  }

  return elem;
}

function button(args){
  elem = div(args);
  apply({
    class: 'btn',
  });
}

function segmented(args){
  elem = div(args);
  element.init(elem, {
    classes: 'segmented',
  });
  var activate = function(arg, silent){
    if(activeElem === arg){
      return;
    }
    elem.val = arg.val;
    arg.classList.add('active');
    if(activeElem instanceof Node){
      activeElem.classList.remove('active');
    }
    activeElem = arg;
    if(typeof args.onvalue === "function"){
      args.onvalue(elem.val);
    }

    if(!silent && typeof args.onchange === "function"){
      args.onchange(elem.val);
    }
  };
  var options;
  var activeElem;
  var optionElements = {};
  if(args.options instanceof Array){
    options = args.options;
    optionElements = options.map(function(opt, i){
      var optElem = span({
        content: opt,
        parent: elem,
        action: function(ev){
          if(optElem !== activeElem){
            activate(optElem);
          }
        },
      });
      optElem.val = i;
      if(activeElem == null){
        activate(optElem, true);
      }
      return optElem;
    });
  }
  else if (typeof args.options === "object"){
    Object.keys(args.options).map(function(i){
      var opt = args.options[i];
      var value = i;
      if(typeof opt === "string"){
        var text = opt;
      }
      var optElem = span({
        content: text,
        parent: elem,
        action: function(ev){
          if(optElem !== activeElem){
            activate(optElem);
          }
        },
      });
      optElem.val = value;
      if(activeElem == null){
        activate(optElem, true);
      }
      optionElements[i] = optElem;
    });
  }
  if(args.value != null){
    activate(optionElements[args.value], true);
  }
  if(typeof args.onvalue === "function"){
    args.onvalue(elem.val);
  }
}