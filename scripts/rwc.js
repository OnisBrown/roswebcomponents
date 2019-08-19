// Detect mobile devices
var md = new MobileDetect(window.navigator.userAgent);
var isPhone = md.mobile() != null;
if (isPhone){
  console.log("Client is a phone or tablet");
} else {
  console.log("Client is not a phone or tablet");
}

// Load config of topic and action server names from 'rwc-config.json'
var configJSON;
var currentActionClient;
var JSONreq = $.getJSON("rwc-config.json", function(json){
  configJSON = json;
});

// Dictionary of listener functions, for matching 'data-listener' listener names to
// functions
var listeners = {
  "getCurrentPage": rwcListenerGetCurrentPage,
  "getPosition": rwcListenerGetPosition,
  "getOrientation": rwcListenerGetOrientation,
  "getNearestPersonPosition": rwcListenerGetNearestPersonPosition,
  "getPeoplePositions": rwcListenerGetPeoplePositions,
  "getNumberOfPeople": rwcListenerGetNumberOfPeople,
  "getNode": rwcListenerGetNode,
  "getBatteryPercentage": rwcListenerGetBatteryPercentage,
  "getVolumePercent": rwcListenerGetVolumePercent
};

// Dictionary of action functions, for matching 'data-action' action names to
// functions
var actions = {
  "setPoseRelative": rwcActionSetPoseRelative,
  "setPoseMap": rwcActionSetPoseMap,
  "goToNode": rwcActionGoToNode,
  "volumePercentChange": rwcActionVolumePercentChange,
  "say": rwcActionSay,
  "gazeAtPosition": rwcActionGazeAtPosition
};

// List of 'data-action' action names which require their parameter to be parsed as
// string
strActions = [
  "goToNode",
  "say"
];

// List of 'data-action' action names which require their parameter to be parsed as
// integer
intActions = [
  "volumePercentChange"
];

// List of 'data-action' action names which require their parameters to be parsed
// as an array of numbers
numArrayActions = [
  "setPoseRelative",
  "setPoseMap",
  "gazeAtPosition"
];

// List of goal status ID's and the status' corresponding names
var goalStatusNames = [
  "PENDING",
  "ACTIVE",
  "PREEMPTED",
  "SUCCEEDED",
  "ABORTED",
  "REJECTED",
  "PREEMPTING",
  "RECALLING",
  "RECALLED",
  "LOST"
];

// Array to track instances of live components for bulk updating
var liveListenerComponents = [];

// Array to track instances of static components for bulk updating
var staticListenerComponents = [];

// Array to track instances of toggleable components for bulk enabling/disabling
var toggleableComponents = [];

// Global var to track currrent page
window.rwcCurrentPage = window.location.pathname;

// Global var to track IDs of individually disabled components
var disabledComponentIDs = [];

// Global var to track IDs of initially disabled components which are enabled
var startDisabledEnabledComponentIDs = [];

$(document).ready(function(){
  // Publish '/rwc/page_loaded'
  pageLoadedString.data = window.rwcCurrentPage;
  pageLoadedTopic.publish(pageLoadedString);

  // Get disabled component IDs and disable components which were disabled
  // before the page was loaded
  disabledTopic.subscribe(function(message){
    disabledComponentIDs = JSON.parse(message.data);
    toggleableComponents.forEach(function(element){
      if (disabledComponentIDs.includes(element.dataset.id)){
        element.disable();
      }
    });
    disabledTopic.unsubscribe();
  });

  // Check which elements are individually disabled
  window.rwcDisabledComponents = [];
  toggleableComponents.forEach(function(element){
    if (element.disabled == true) {
      window.rwcDisabledComponents.push(element);
    }
  });

  // Check if any components which are set to start disabled have been enabled
  startDisabledEnabledTopic.subscribe(function(message){
    startDisabledEnabledComponentIDs = JSON.parse(message.data);
    window.rwcDisabledComponents.forEach(function(component){
      if (startDisabledEnabledComponentIDs.includes(component.dataset.id)){
        component.enable();
      }
    });
  });

  // Initial publication of '/rwc/current_page'
  currentPageTopicString.data = window.rwcCurrentPage;
  currentPageTopic.publish(currentPageTopicString);

  // Initial publication of '/rwc/components_currently_clicked'
  // Build, stringify, and publish clicked dictionary
  clickedComponents = {};
  toggleableComponents.forEach(function(element){
    clickedComponents[element.dataset.id] = element.clicked;
  });

  clickedComponentsString = JSON.stringify(clickedComponents);
  clickedTopicString.data = clickedComponentsString;
  clickedTopic.publish(clickedTopicString);

  window.rwcClickedComponents = clickedComponents;

  staticListenerComponents.forEach(function(item, index){
    setTimeout(function(){item.update();}, 500);
  });

  liveListenerComponents.forEach(function(item, index){
    setTimeout(function(){item.update();}, 500);
  });

  spinner = document.createElement("div");
  spinner.setAttribute("class", "spin");
  document.body.appendChild(spinner);

  stopButton = document.createElement("div");
  stopButton.setAttribute("class", "cancel-button rwc-button-action-start");
  stopButtonSpan = document.createElement("span");
  stopButtonSpan.innerHTML = "Cancel action";
  stopButton.appendChild(stopButtonSpan);
  if(isPhone){
    stopButton.addEventListener('touchstart', function(event){
      cancelCurrentAction();
    });
  } else {
    stopButton.addEventListener('click', e => {
      cancelCurrentAction();
    });
  }
  document.body.appendChild(stopButton);

  window.setInterval(function(){
    interfaceEnabledParam.get(function(param){
      window.rwcInterfaceEnabled = param;
    });

    if (window.rwcInterfaceEnabled == 1){
      toggleableComponents.forEach(function(element){
        if (!window.rwcDisabledComponents.includes(element)){
          element.disabled = false;
        }
      });
      $(".spin").spin("hide");
    } else if(window.rwcInterfaceEnabled == 0){
      toggleableComponents.forEach(function(element){element.disabled = true;});
      $(".spin").spin("show");
    }

    // Publish '/rwc/current_page'
    rwcListenerGetCurrentPage().then(function(subCurrentPage){
      if (window.rwcCurrentPage != subCurrentPage){
        window.rwcCurrentPage = subCurrentPage;
        currentPageTopicString.data = window.rwcCurrentPage;
        currentPageTopic.publish(currentPageTopicString);
      }
    });

    // Publish `/rwc/disabled_components`
    // disabledComponentIDs = [];
    window.rwcDisabledComponents.forEach(function(element){
      if (!(disabledComponentIDs.includes(element.dataset.id))){
        disabledComponentIDs.push(element.dataset.id);
      }
    });
    disabledTopicString.data = JSON.stringify(disabledComponentIDs);
    disabledTopic.publish(disabledTopicString);

    // Build, stringify, and publish clicked dictionary
    clickedComponents = {};
    toggleableComponents.forEach(function(element){
      clickedComponents[element.dataset.id] = element.clicked;
    });

    if (typeof window.rwcClickedComponents !== 'undefined'){
      clickedComponentsString = JSON.stringify(clickedComponents);
      if (clickedComponentsString !== JSON.stringify(window.rwcClickedComponents)){
        clickedTopicString.data = clickedComponentsString;
        clickedTopic.publish(clickedTopicString);
      }
    }

    window.rwcClickedComponents = clickedComponents;
  }, 250);
});

// Connection to ROSbridge server websocket
var ros = new ROSLIB.Ros({
    url: 'ws://localhost:9090'
});

ros.on('connection', function(){
    console.log('Connected to websocket server.');
    enableInterface();
    $(".spin").spin("hide");
});

ros.on('error', function(){
    console.log('Error connecting to websocket server.');
    disableInterface();
    $(".spin").spin("show");
    setTimeout(function(){
      location.reload();
    }, 5000);
});

ros.on('close', function(){
    console.log('Closed connection to websocket server.');
    disableInterface();
    $(".spin").spin("show");
    setTimeout(function(){
      location.reload();
    }, 5000);
});

// Variables for tracking current action in a ROS topic
var currentActionTopic = new ROSLIB.Topic({
  ros : ros,
  name : "/rwc/current_action",
  messageType : "std_msgs/String",
  latch: true
});

var currentActionTopicString = new ROSLIB.Message({
  data : ""
});

// Variables for tracking current page in a ROS topic
var currentPageTopic = new ROSLIB.Topic({
  ros : ros,
  name : "/rwc/current_page",
  messageType : "std_msgs/String",
  latch: true
});

var currentPageTopicString = new ROSLIB.Message({
  data : ""
});

// Variables for tracking object click / touch interactions in a ROS topic
var clickedTopic = new ROSLIB.Topic({
  ros : ros,
  name : "/rwc/components_currently_clicked",
  messageType : "std_msgs/String",
  latch: true
});

var clickedTopicString = new ROSLIB.Message({
  data : ""
});

// Variables for tracking individually disabled components in a ROS topic
var disabledTopic = new ROSLIB.Topic({
  ros : ros,
  name : "/rwc/disabled_components",
  messageType : "std_msgs/String",
  latch: true
});

var disabledTopicString = new ROSLIB.Message({
  data : ""
});

// ROS topic for tracking components which start disabled and are enabled
var startDisabledEnabledTopic = new ROSLIB.Topic({
  ros : ros,
  name : "/rwc/start_disabled_enabled_components",
  messageType : "std_msgs/String",
  latch: true
});

var startDisabledEnabledTopicString = new ROSLIB.Message({
  data : ""
});

// ROS topic for publishing `/rwc/page_loaded`
var pageLoadedTopic = new ROSLIB.Topic({
  ros : ros,
  name : "/rwc/page_loaded",
  messageType : "std_msgs/String"
});

var pageLoadedString = new ROSLIB.Message({
  data : ""
});


// ROS parameter '/interface_enabled'
var interfaceEnabledParam = new ROSLIB.Param({
  ros: ros,
  name: "/interface_enabled"
});


// General functions
function disableInterface(){
  window.rwcDisabledComponents = [];
  toggleableComponents.forEach(function(element){
    if (element.disabled == true) {
      window.rwcDisabledComponents.push(element);
    }
  });
  interfaceEnabledParam.set(0);
  $(".spin").show();
}

function enableInterface(){
  interfaceEnabledParam.set(1);
  $(".spin").hide();
}

function cancelCurrentAction(){
  currentActionClient.cancel();
  enableInterface();
}

// --- Action fuctions ---
// Action function 'rwcActionSetPoseRelative'
function rwcActionSetPoseRelative(x, y, z, quaternion = {x: 0, y: 0, z: 0, w: 1}){
  var msg = {
    target_pose: {
        header :{
            frame_id: "base_link"
        },
        pose: {
            position: {
                x: x,
                y: y,
                z: z
                },
            orientation: quaternion
        }
    }
  };

  // Action name and action server name loaded from rwc-config JSON file
  var serverName = configJSON.actions.actionServers.move_base.actionServerName;
  var actionName = configJSON.actions.actionServers.move_base.actionName;

  var actionClient = new ROSLIB.ActionClient({
    ros: ros,
    serverName: serverName,
    actionName: actionName
  });

  currentActionClient = actionClient;
  currentActionTopicString.data = currentActionClient.actionName;
  currentActionTopic.publish(currentActionTopicString);

  goal = new ROSLIB.Goal({
    actionClient: actionClient,
    goalMessage: msg
  });

  goal.on('result', function (status) {
    console.log(goal.status.text);
    enableInterface();
  });

  goal.send();
  disableInterface();
  console.log("Goal '" + serverName + "/goal' sent!");

  return goal;
}


// Action function 'rwcActionSetPoseMap'
function rwcActionSetPoseMap(x, y, z, quaternion = {x: 0, y: 0, z: 0, w: 1}){
  var msg = {
    target_pose: {
        header :{
            frame_id: "map"
        },
        pose: {
            position: {
                x: x,
                y: y,
                z: z
                },
            orientation: quaternion
        }
    }
  };

  // Action name and action server name loaded from rwc-config JSON file
  var serverName = configJSON.actions.actionServers.move_base.actionServerName;
  var actionName = configJSON.actions.actionServers.move_base.actionName;

  var actionClient = new ROSLIB.ActionClient({
    ros: ros,
    serverName: serverName,
    actionName: actionName
  });

  currentActionClient = actionClient;
  currentActionTopicString.data = currentActionClient.actionName;
  currentActionTopic.publish(currentActionTopicString);

  goal = new ROSLIB.Goal({
    actionClient: actionClient,
    goalMessage: msg
  });

  goal.on('result', function (status) {
    console.log(goal.status.text);
    enableInterface();
  });

  goal.send();
  disableInterface();
  console.log("Goal '" + serverName + "/goal' sent!");

  return goal;
}


// Action function 'rwcActionGoToNode'
function rwcActionGoToNode(node_name, no_orientation = false){
  var msg = {
    target: node_name,
    no_orientation: no_orientation
  };

  // Action name and action server name loaded from rwc-config JSON file
  var serverName = configJSON.actions.actionServers.topological_navigation.actionServerName;
  var actionName = configJSON.actions.actionServers.topological_navigation.actionName;

  var actionClient = new ROSLIB.ActionClient({
    ros: ros,
    serverName: serverName,
    actionName: actionName
  });

  currentActionClient = actionClient;
  currentActionTopicString.data = currentActionClient.actionName;
  currentActionTopic.publish(currentActionTopicString);

  goal = new ROSLIB.Goal({
    actionClient: actionClient,
    goalMessage: msg
  });

  goal.on('result', function (status) {
    status = goal.status.status;
    console.log("Action status: " + goalStatusNames[status]);
    if (goalStatusNames[status] !== "PENDING"){enableInterface();}
  });

  goal.send();
  disableInterface();
  console.log("Goal '" + serverName + "/goal' sent!");

  return goal;
}


// Action function 'rwcActionVolumePercentChange'
function rwcActionVolumePercentChange(percentage_change){
  // Topic info loaded from rwc-config JSON file
  var pcntChangeTopic = new ROSLIB.Topic({
    ros : ros,
    name : configJSON.actions.topics.volume.topicName,
    messageType : configJSON.actions.topics.volume.topicMessageType
  });

  var Int8 = new ROSLIB.Message({
    data : percentage_change
  });
  pcntChangeTopic.publish(Int8);
  if(percentage_change >= 0){
    console.log("Volume changed by +" + percentage_change + "%");
  } else { 
    console.log("Volume changed by " + percentage_change + "%");
  }
}


// Action function 'rwcActionSay'
function rwcActionSay(phrase){
  var msg = {
    text: phrase
  };

  // Action name and action server name loaded from rwc-config JSON file
  var serverName = configJSON.actions.actionServers.speak.actionServerName;
  var actionName = configJSON.actions.actionServers.speak.actionName;

  var actionClient = new ROSLIB.ActionClient({
    ros: ros,
    serverName: serverName,
    actionName: actionName
  });

  currentActionClient = actionClient;
  currentActionTopicString.data = currentActionClient.actionName;
  currentActionTopic.publish(currentActionTopicString);

  goal = new ROSLIB.Goal({
    actionClient: actionClient,
    goalMessage: msg
  });

  goal.on('result', function (status) {
    status = goal.status.status;
    console.log("Action status: " + goalStatusNames[status]);
  });

  goal.send();
  console.log("Goal '" + serverName + "/goal' sent!");

  return goal;
}

// Action function 'rwcActionGazeAtPosition'
function rwcActionGazeAtPosition(x, y, z, secs){
  var rwcPoseTopic = new ROSLIB.Topic({
    ros : ros,
    name : "/rwc_gaze_pose",
    messageType : "geometry_msgs/PoseStamped"
  });

  header = {
    seq: 0,
    stamp: {
      secs: 1,
      nsecs:1},
    frame_id: "map"
  };
  position = new ROSLIB.Vector3(null);
  position.x = x;
  position.y = y;
  position.z = z;
  orientation = new ROSLIB.Quaternion({x:0, y:0, z:0, w:1.0});
  var poseStamped = new ROSLIB.Message({
    header: header,
    pose: {
      position: position,
      orientation: orientation
    }
  });
  rwcPoseTopic.publish(poseStamped);
  console.log("Gaze pose published...");

  var gazeActionClient = new ROSLIB.ActionClient({
    ros: ros,
    serverName: "/gaze_at_pose",
    actionName: "strands_gazing/GazeAtPoseAction"
  });

  currentActionClient = gazeActionClient;

  msg = {
    runtime_sec: secs,
    topic_name: "/rwc_gaze_pose"
  };

  goal = new ROSLIB.Goal({
    actionClient: gazeActionClient,
    goalMessage: msg
  });

  goal.on('result', function (status) {
    console.log("Action '/gaze_at_pose/' completed!");
  });

  goal.send();
  console.log("Goal '/gaze_at_pose/goal' sent!");

  return goal;
}


// Action function 'rwcActionCustom'
function rwcActionCustom(actionComponent){
  $.getJSON(actionComponent.dataset.goalMsgPath, function(json){
    var msg = json;
    console.log(actionComponent.dataset.action);

    // Action name and action server name loaded from rwc-config JSON file
    var serverName = configJSON.actions.actionServers[actionComponent.dataset.action].actionServerName;
    var actionName = configJSON.actions.actionServers[actionComponent.dataset.action].actionName;
  
    var actionClient = new ROSLIB.ActionClient({
      ros: ros,
      serverName: serverName,
      actionName: actionName
    });
  
    currentActionClient = actionClient;
    currentActionTopicString.data = currentActionClient.actionName;
    currentActionTopic.publish(currentActionTopicString);

    var goal = new ROSLIB.Goal({
      actionClient: actionClient,
      goalMessage: msg
    });
  
    goal.on('result', function (status) {
      status = goal.status.status;
      console.log("Action status: " + goalStatusNames[status]);
      if (goalStatusNames[status] !== "PENDING"){enableInterface();}
    });
  
    goal.send();
    disableInterface();
    console.log("Goal '" + serverName + "/goal' sent!");

    console.log("Action '" + actionComponent.dataset.action + "' started!\nParameter(s): " +
    actionComponent.dataset.actionParameters);
  });
}

// --- Listener functions ---
// Listener function 'rwcListenerGetCurrentPage'
async function rwcListenerGetCurrentPage(listenerComponent = null){
  var listener = currentPageTopic;

  // promise function called and function execution halts until
  // the promise is resolved
  rwcCurrentPage = await subCurrentPage(listener, listenerComponent);

  return rwcCurrentPage;
}

// Promise returns value 50ms after subscribing to topic,
// preventing old or undefined values from being returned
function subCurrentPage(listener, listenerComponent = null){
  return new Promise(function(resolve) {
    listener.subscribe(function(message) {
      var rwcCurrentPage = message.data;
      if (listenerComponent === null){
        listener.unsubscribe();
      }
      else if (listenerComponent.dataset.live === "false"){
        listenerComponent.shadowRoot.innerHTML = "<span>" + rwcCurrentPage + "</span>";
        listener.unsubscribe();
      }
      else {
        listenerComponent.shadowRoot.innerHTML = "<span>" + rwcCurrentPage + "</span>";
      }
      setTimeout(function(){
        resolve(rwcCurrentPage);
      }, 50);
    });
  });
}


// Listener function 'rwcListenerGetPosition'
async function rwcListenerGetPosition(listenerComponent = null){
  // Topic info loaded from rwc-config JSON file
  var listener = new ROSLIB.Topic({
    ros : ros,
    name : configJSON.listeners.odom.topicName,
    messageType : configJSON.listeners.odom.topicMessageType
  });

  // promise function called and function execution halts until
  // the promise is resolved
  rwcPosition = await subPosition(listener, listenerComponent);

  return rwcPosition;
}

// Promise returns value 50ms after subscribing to topic,
// preventing old or undefined values from being returned
function subPosition(listener, listenerComponent = null){
  return new Promise(function(resolve) {
    listener.subscribe(function(message) {
      var rwcPosition = [message.pose.pose.position.x,
        message.pose.pose.position.y,
        message.pose.pose.position.z];
      if (listenerComponent === null){
        listener.unsubscribe();
      }
      else if (listenerComponent.dataset.live === "false"){
        listenerComponent.shadowRoot.innerHTML = "<span>" + rwcPosition + "</span>";
        listener.unsubscribe();
      }
      else {
        listenerComponent.shadowRoot.innerHTML = "<span>" + rwcPosition + "</span>";
      }
      setTimeout(function(){
        resolve(rwcPosition);
      }, 50);
    });
  });
}

// Listener function 'rwcListenerGetOrientation'
async function rwcListenerGetOrientation(listenerComponent = null){
  // Topic info loaded from rwc-config JSON file
  var listener = new ROSLIB.Topic({
    ros : ros,
    name : configJSON.listeners.odom.topicName,
    messageType : configJSON.listeners.odom.topicMessageType
  });

  rwcOrientation = await subOrientation(listener, listenerComponent);

  return rwcOrientation;
}

// Promise returns value 50ms after subscribing to topic,
// preventing old or undefined values from being returned
function subOrientation(listener, listenerComponent = null){
  return new Promise(function(resolve) {
    listener.subscribe(function(message) {
      var rwcOrientation = [message.pose.pose.orientation.x,
        message.pose.pose.orientation.y,
        message.pose.pose.orientation.z,
        message.pose.pose.orientation.w];
        if (listenerComponent === null){
          listener.unsubscribe();
        }
        else if (listenerComponent.dataset.live === "false"){
          listenerComponent.shadowRoot.innerHTML = "<span>" + rwcOrientation + "</span>";
          listener.unsubscribe();
        }
        else {
          listenerComponent.shadowRoot.innerHTML = "<span>" + rwcOrientation + "</span>";
        }
      setTimeout(function(){
        resolve(rwcOrientation);
      }, 50);
    });
  });
}

// Listener function 'rwcListenerGetNearestPersonPosition'
async function rwcListenerGetNearestPersonPosition(listenerComponent = null){
  // Topic info loaded from rwc-config JSON file
  var listener = new ROSLIB.Topic({
    ros : ros,
    name : configJSON.listeners.nearest_person_pose.topicName,
    messageType : configJSON.listeners.nearest_person_pose.topicMessageType
  });

  // promise function called and function execution halts until
  // the promise is resolved
  rwcNearestPersonPosition = await subNearestPersonPosition(listener, listenerComponent);

  return rwcNearestPersonPosition;
}

// Promise returns value 50ms after subscribing to topic,
// preventing old or undefined values from being returned
function subNearestPersonPosition(listener, listenerComponent = null){
  return new Promise(function(resolve) {
    listener.subscribe(function(message) {
      rwcNearestPersonPosition = [message.pose.position.x,
        message.pose.position.y,
        message.pose.position.z];
        if (listenerComponent === null){
          listener.unsubscribe();
        }
        else if (listenerComponent.dataset.live === "false"){
          listenerComponent.shadowRoot.innerHTML = "<span>" + rwcNearestPersonPosition + "</span>";
          listener.unsubscribe();
        }
        else {
          listenerComponent.shadowRoot.innerHTML = "<span>" + rwcNearestPersonPosition + "</span>";
        }
      setTimeout(function(){
        resolve(rwcNearestPersonPosition);
      }, 50);
    });
  });
}

// Listener function 'rwcListenerGetPeoplePositions'
async function rwcListenerGetPeoplePositions(listenerComponent = null){
  // Topic info loaded from rwc-config JSON file
  var listener = new ROSLIB.Topic({
    ros : ros,
    name : configJSON.listeners.people_pose_array.topicName,
    messageType : configJSON.listeners.people_pose_array.topicMessageType
  });

  // promise function called and function execution halts until
  // the promise is resolved
  rwcPeoplePoses = await subPeoplePositions(listener, listenerComponent);

  rwcPeoplePositions = [];
  rwcPeoplePoses.forEach(function(person_pose){
    rwcPeoplePositions.push([person_pose.position.x, person_pose.position.y, person_pose.position.z]);
  });

  return rwcPeoplePositions;
}

// Promise returns value 50ms after subscribing to topic,
// preventing old or undefined values from being returned
function subPeoplePositions(listener, listenerComponent = null){
  return new Promise(function(resolve) {
    listener.subscribe(function(message) {
      rwcPeoplePositions = message.poses;
      if (listenerComponent === null){
        listener.unsubscribe();
      }
      else if (listenerComponent.dataset.live === "false"){
        listenerComponent.shadowRoot.innerHTML = "<span>" + rwcPeoplePositions + "</span>";
        listener.unsubscribe();
      }
      else {
        listenerComponent.shadowRoot.innerHTML = "<span>" + rwcPeoplePositions + "</span>";
      }
      setTimeout(function(){
        resolve(rwcPeoplePositions);
      }, 50);
    });
  });
}

// Listener function 'rwcListenerGetNumberOfPeople'
async function rwcListenerGetNumberOfPeople(listenerComponent = null){
  // Topic info loaded from rwc-config JSON file
  var listener = new ROSLIB.Topic({
    ros : ros,
    name : configJSON.listeners.people_pose_array.topicName,
    messageType : configJSON.listeners.people_pose_array.topicMessageType
  });

  // promise function called and function execution halts until
  // the promise is resolved
  rwcPeoplePoses = await subPeoplePositions(listener, listenerComponent);

  return rwcPeoplePositions.length;
}

// Listener function 'rwcListenerGetNode'
async function rwcListenerGetNode(listenerComponent = null){
  // Topic info loaded from rwc-config JSON file
  var listener = new ROSLIB.Topic({
    ros : ros,
    name : configJSON.listeners.current_node.topicName,
    messageType : configJSON.listeners.current_node.topicMessageType
  });

  rwcNode = await subNode(listener, listenerComponent);

  return rwcNode;
}

// Promise returns value 50ms after subscribing to topic,
// preventing old or undefined values from being returned
function subNode(listener, listenerComponent = null){
  return new Promise(function(resolve) {
    listener.subscribe(function(message) {
      var rwcNode = message.data;
      if (listenerComponent === null){
        listener.unsubscribe();
      }
      else if (listenerComponent.dataset.live === "false"){
        listenerComponent.shadowRoot.innerHTML = "<span>" + rwcNode + "</span>";
        listener.unsubscribe();
      }
      else {
        listenerComponent.shadowRoot.innerHTML = "<span>" + rwcNode + "</span>";
      }
      setTimeout(function(){
        resolve(rwcNode);
      }, 50);
    });
  });
}

// Listener function 'rwcListenerGetBatteryPercentage'
async function rwcListenerGetBatteryPercentage(listenerComponent = null){
  // Topic info loaded from rwc-config JSON file
  var listener = new ROSLIB.Topic({
    ros : ros,
    name : configJSON.listeners.battery_state.topicName,
    messageType : configJSON.listeners.battery_state.topicMessageType
  });

  rwcBatteryPercentage = await subBatteryPercentage(listener, listenerComponent);

  return rwcBatteryPercentage;
}

// Promise returns value 50ms after subscribing to topic,
// preventing old or undefined values from being returned
function subBatteryPercentage(listener, listenerComponent = null){
  return new Promise(function(resolve) {
    listener.subscribe(function(message) {
      var rwcBatteryPercentage = message.lifePercent;
      if (listenerComponent === null){
        listener.unsubscribe();
      }
      else if (listenerComponent.dataset.live === "false"){
        listenerComponent.shadowRoot.innerHTML = "<span>" + rwcBatteryPercentage + "</span>";
        listener.unsubscribe();
      }
      else {
        listenerComponent.shadowRoot.innerHTML = "<span>" + rwcBatteryPercentage + "</span>";
      }
      setTimeout(function(){
        resolve(rwcBatteryPercentage);
      }, 50);
    });
  });
}

// Listener function 'rwcListenerGetVolumePercent'
async function rwcListenerGetVolumePercent(listenerComponent = null){
  // Topic info loaded from rwc-config JSON file
  var listener = new ROSLIB.Topic({
    ros : ros,
    name : configJSON.listeners.volume.topicName,
    messageType : configJSON.listeners.volume.topicMessageType
  });

  rwcVolumePercent = await subVolumePercent(listener, listenerComponent);

  return rwcVolumePercent;
}

// Promise returns value 50ms after subscribing to topic,
// preventing old or undefined values from being returned
function subVolumePercent(listener, listenerComponent = null){
  return new Promise(function(resolve) {
    listener.subscribe(function(message) {
      var rwcVolumePercent = message.data;
      if (listenerComponent === null){
        listener.unsubscribe();
      }
      else if (listenerComponent.dataset.live === "false"){
        listenerComponent.shadowRoot.innerHTML = "<span>" + rwcVolumePercent + "</span>";
        listener.unsubscribe();
      }
      else {
        listenerComponent.shadowRoot.innerHTML = "<span>" + rwcVolumePercent + "</span>";
      }
      setTimeout(function(){
        resolve(rwcVolumePercent);
      }, 50);
    });
  });
}

// Listener function 'rwcListenerGetCameraSnapshot'
function rwcListenerGetCameraSnapshot(){
  // Latest camera image obtained from 'web_video_server'
  var img = new Image();
  img.src = configJSON.listeners.camera_snapshot.uri;
  return img;
}

// Listener function 'rwcListenerGetQRCode'
function rwcListenerGetQRCode(){
  // Latest camera image obtained from 'web_video_server'
  var img = new Image();
  img.src = configJSON.listeners.camera_snapshot.uri;

  // Temporary HTML5 canvas created to call getImageData 
  var canvas = document.createElement('canvas');
  var context = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  context.drawImage(img, 0, 0 );
  var imgData = context.getImageData(0, 0, img.width, img.height);
  const code = jsQR(imgData.data, imgData.width, imgData.height);
  if (code) {
    return code.data;
  } else {
    return "No QR code detected!";
  }
}

// Listener function 'rwcListenerCustom'
async function rwcListenerCustom(listenerComponent = null, fieldSelector = null){
  // Topic info loaded from rwc-config JSON file
  var listener = new ROSLIB.Topic({
    ros : ros,
    name : configJSON.listeners[listenerComponent.dataset.listener].topicName,
    messageType : configJSON.listeners[listenerComponent.dataset.listener].topicMessageType
  });

  rwcNode = await subCustom(listener, listenerComponent, fieldSelector);

  return rwcNode;
}

// Promise returns value 50ms after subscribing to topic,
// preventing old or undefined values from being returned
function subCustom(listener, listenerComponent = null, fieldSelector = null){
  return new Promise(function(resolve) {
    listener.subscribe(function(message) {
      fieldSelectorArr = fieldSelector.split(".");
      var data = message;
      fieldSelectorArr.forEach(function(field){
        data = data[field];
      });
      data = JSON.stringify(data);
      if (listenerComponent === null){
        listener.unsubscribe();
      }
      else if (listenerComponent.dataset.live === "false"){
        listenerComponent.shadowRoot.innerHTML = "<span>" + data + "</span>";
        listener.unsubscribe();
      }
      else {
        listenerComponent.shadowRoot.innerHTML = "<span>" + data + "</span>";
      }
      setTimeout(function(){
        resolve(data);
      }, 50);
    });
  });
}


// --- Web Components ---

// --- Action Components ---
// Class for custom element 'rwc-button-action-start'
class rwcButtonActionStart extends HTMLElement {
  connectedCallback() {
    this.clicked = false;

    if (this.dataset.disabled && !(startDisabledEnabledComponentIDs.includes(this.dataset.id))) {
      this.isDisabled = true;
    } else {
      this.isDisabled = false;
    }

    this.rwcClass;

    if (this.isDisabled) {
      if (this.hasAttribute("data-disabled-class")) {
        this.rwcClass = this.dataset.disabledClass;
      } else {
        this.rwcClass = "rwc-button-action-start-disabled";
      }
    } else {
      if (this.hasAttribute("data-class")) {
        this.rwcClass = this.dataset.class;
      } else {
        this.rwcClass = "rwc-button-action-start";
      }
    }

    var actionButton = this;

    if(isPhone){
      this.addEventListener('touchstart', e => {
        this.clicked = true;
        if (!this.isDisabled){
          if (strActions.includes(this.dataset.action)) {
            actions[this.dataset.action](this.dataset.actionParameters);
          }
          if (intActions.includes(this.dataset.action)) {
            actions[this.dataset.action](parseInt(this.dataset.actionParameters));
          }
          if (numArrayActions.includes(this.dataset.action)) {
            var strArray = this.dataset.actionParameters.split(",");
            var floatArray = strArray.map(Number);
            actions[this.dataset.action](floatArray);
          }
          if (!(Object.keys(actions).includes(this.dataset.action))){
            rwcActionCustom(this);
          }
          var actionButton = this;
          setTimeout(function(){
            actionButton.clicked = false;
          }, 500);
        }
      });
    } else {
      this.addEventListener('click', e => {
        this.clicked = true;
        if (!this.isDisabled){
          if (strActions.includes(this.dataset.action)) {
            actions[this.dataset.action](this.dataset.actionParameters);
          }
          if (intActions.includes(this.dataset.action)) {
            actions[this.dataset.action](parseInt(this.dataset.actionParameters));
          }
          if (numArrayActions.includes(this.dataset.action)) {
            var strArray = this.dataset.actionParameters.split(",");
            var floatArray = strArray.map(Number);
            actions[this.dataset.action](floatArray);
          }
          if (!(Object.keys(actions).includes(this.dataset.action))){
            rwcActionCustom(this);
          }
        }
        setTimeout(function(){
          actionButton.clicked = false;
        }, 500);
      });
    }

    const shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.innerHTML = '<style>@import url("styles/rwc-styles.css")</style>'
    + '<style>@import url("styles/rwc-user-styles.css")</style><div id="'
    + this.dataset.id + '" class="' + this.rwcClass
    + '"><span>' + this.dataset.text + '</span></div>';

    toggleableComponents.push(this);
  }

  set disabled(bool){
    this.isDisabled = bool;

    if (this.isDisabled) {
      if (this.hasAttribute("data-disabled-class")) {
        this.rwcClass = this.dataset.disabledClass;
      } else {
        this.rwcClass = "rwc-button-action-start-disabled";
      }
    } else {
      if (this.hasAttribute("data-class")) {
        this.rwcClass = this.dataset.class;
      } else {
        this.rwcClass = "rwc-button-action-start";
      }
    }

    this.shadowRoot.querySelector("div").setAttribute("class", this.rwcClass);

  }

  get disabled(){
    return this.isDisabled;
  }

  disable(){
    if (!window.rwcDisabledComponents.includes(this)){
      window.rwcDisabledComponents.push(this);
    }
    if (startDisabledEnabledComponentIDs.includes(this.dataset.id)){
      var index = startDisabledEnabledComponentIDs.indexOf(this.dataset.id);
      if (index > -1){
        startDisabledEnabledComponentIDs.splice(index, 1);
        startDisabledEnabledTopicString.data = JSON.stringify(startDisabledEnabledComponentIDs);
        startDisabledEnabledTopic.publish(startDisabledEnabledTopicString);
      }
    }
    this.disabled = true;
  }

  enable(){
    this.disabled = false;
    window.rwcDisabledComponents = [];
    toggleableComponents.forEach(function(element){
      if (element.disabled == true) {
        window.rwcDisabledComponents.push(element);
      }
    });

    if (this.dataset.disabled){
      if (!(startDisabledEnabledComponentIDs.includes(this.dataset.id))){
        startDisabledEnabledComponentIDs.push(this.dataset.id);
      }
    }

    startDisabledEnabledTopicString.data = JSON.stringify(startDisabledEnabledComponentIDs);
    startDisabledEnabledTopic.publish(startDisabledEnabledTopicString);

    var index = disabledComponentIDs.indexOf(this.dataset.id);
    if (index > -1){
      disabledComponentIDs.splice(index, 1);
    }
    disabledTopicString.data = JSON.stringify(disabledComponentIDs);
    disabledTopic.publish(disabledTopicString);
  }
}

customElements.define("rwc-button-action-start", rwcButtonActionStart);


// Class for custom element 'rwc-text-action-start'
class rwcTextActionStart extends HTMLElement {
  connectedCallback() {
    this.clicked = false;
    if (this.dataset.disabled) {
      this.isDisabled = true;
    } else {
      this.isDisabled = false;
    }

    this.rwcClass;

    if (this.isDisabled) {
      if (this.hasAttribute("data-disabled-class")) {
        this.rwcClass = this.dataset.disabledClass;
      } else {
        this.rwcClass = "rwc-text-action-start-disabled";
      }
    } else {
      if (this.hasAttribute("data-class")) {
        this.rwcClass = this.dataset.class;
      } else {
        this.rwcClass = "rwc-text-action-start";
      }
    }

    var actionButton = this;

    if(isPhone){
      this.addEventListener('touchstart', e => {
        this.clicked = true;
        if (!this.isDisabled){
          if (strActions.includes(this.dataset.action)) {
            actions[this.dataset.action](this.dataset.actionParameters);
          }
          if (intActions.includes(this.dataset.action)) {
            actions[this.dataset.action](parseInt(this.dataset.actionParameters));
          }
          if (numArrayActions.includes(this.dataset.action)) {
            var strArray = this.dataset.actionParameters.split(",");
            var floatArray = strArray.map(Number);
            actions[this.dataset.action](floatArray);
          }
          if (!(Object.keys(actions).includes(this.dataset.action))){
            rwcActionCustom(this);
        }
        var actionButton = this;
          setTimeout(function(){
            actionButton.clicked = false;
          }, 500);
        }
      });
    } else {
      this.addEventListener('click', e => {
        this.clicked = true;
        if (!this.isDisabled){
          if (strActions.includes(this.dataset.action)) {
            actions[this.dataset.action](this.dataset.actionParameters);
          }
          if (intActions.includes(this.dataset.action)) {
            actions[this.dataset.action](parseInt(this.dataset.actionParameters));
          }
          if (numArrayActions.includes(this.dataset.action)) {
            var strArray = this.dataset.actionParameters.split(",");
            var floatArray = strArray.map(Number);
            actions[this.dataset.action](floatArray);
          }
          if (!(Object.keys(actions).includes(this.dataset.action))){
            rwcActionCustom(this);
        }
        var actionButton = this;
          setTimeout(function(){
            actionButton.clicked = false;
          }, 500);
        }
      });
    }

    const shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.innerHTML = '<style>@import url("styles/rwc-styles.css")</style>'
    + '<style>@import url("styles/rwc-user-styles.css")</style><span id="'
    + this.dataset.id + '" class="' + this.rwcClass
    + '">' + this.dataset.text + '</span>';

    toggleableComponents.push(this);
  }

  set disabled(bool){
    this.isDisabled = bool;

    if (this.isDisabled) {
      if (this.hasAttribute("data-disabled-class")) {
        this.rwcClass = this.dataset.disabledClass;
      } else {
        this.rwcClass = "rwc-text-action-start-disabled";
      }
    } else {
      if (this.hasAttribute("data-class")) {
        this.rwcClass = this.dataset.class;
      } else {
        this.rwcClass = "rwc-text-action-start";
      }
    }

    this.shadowRoot.querySelector("span").setAttribute("class", this.rwcClass);

  }

  get disabled(){
    return this.isDisabled;
  }

  disable(){
    if (!window.rwcDisabledComponents.includes(this)){
      window.rwcDisabledComponents.push(this);
    }
    this.disabled = true;
  }

  enable(){
    this.disabled = false;
    window.rwcDisabledComponents = [];
    toggleableComponents.forEach(function(element){
      if (element.disabled == true) {
        window.rwcDisabledComponents.push(element);
      }
    });

    if (this.dataset.disabled){
      if (!(startDisabledEnabledComponentIDs.includes(this.dataset.id))){
        startDisabledEnabledComponentIDs.push(this.dataset.id);
      }
    }

    startDisabledEnabledTopicString.data = JSON.stringify(startDisabledEnabledComponentIDs);
    startDisabledEnabledTopic.publish(startDisabledEnabledTopicString);

    var index = disabledComponentIDs.indexOf(this.dataset.id);
    if (index > -1){
      disabledComponentIDs.splice(index, 1);
    }
    disabledTopicString.data = JSON.stringify(disabledComponentIDs);
    disabledTopic.publish(disabledTopicString);
  }
}

customElements.define("rwc-text-action-start", rwcTextActionStart);


// Class for custom element 'rwc-img-action-start'
class rwcImageActionStart extends HTMLElement {
  connectedCallback() {
    this.clicked = false;
    if (this.dataset.disabled) {
      this.isDisabled = true;
    } else {
      this.isDisabled = false;
    }

    this.rwcClass;

    if (this.isDisabled) {
      if (this.hasAttribute("data-disabled-class")) {
        this.rwcClass = this.dataset.disabledClass;
      } else {
        this.rwcClass = "rwc-img-action-start-disabled";
      }
    } else {
      if (this.hasAttribute("data-class")) {
        this.rwcClass = this.dataset.class;
      } else {
        this.rwcClass = "rwc-img-action-start";
      }
    }

    var actionButton = this;

    if(isPhone){
      this.addEventListener('touchstart', e => {
        this.clicked = true;
        if (!this.isDisabled){
          if (strActions.includes(this.dataset.action)) {
            actions[this.dataset.action](this.dataset.actionParameters);
          }
          if (intActions.includes(this.dataset.action)) {
            actions[this.dataset.action](parseInt(this.dataset.actionParameters));
          }
          if (numArrayActions.includes(this.dataset.action)) {
            var strArray = this.dataset.actionParameters.split(",");
            var floatArray = strArray.map(Number);
            actions[this.dataset.action](floatArray);
          }
          if (!(Object.keys(actions).includes(this.dataset.action))){
            rwcActionCustom(this);
        }
        var actionButton = this;
          setTimeout(function(){
            actionButton.clicked = false;
          }, 500);
        }
      });
    } else {
      this.addEventListener('click', e => {
        this.clicked = true;
        if (!this.isDisabled){
          if (strActions.includes(this.dataset.action)) {
            actions[this.dataset.action](this.dataset.actionParameters);
          }
          if (intActions.includes(this.dataset.action)) {
            actions[this.dataset.action](parseInt(this.dataset.actionParameters));
          }
          if (numArrayActions.includes(this.dataset.action)) {
            var strArray = this.dataset.actionParameters.split(",");
            var floatArray = strArray.map(Number);
            actions[this.dataset.action](floatArray);
          }
          if (!(Object.keys(actions).includes(this.dataset.action))){
            rwcActionCustom(this);
          }
          console.log("Action '" + this.dataset.action + "' started!\nParameter(s): " +
          this.dataset.actionParameters);
        }
        var actionButton = this;
          setTimeout(function(){
            actionButton.clicked = false;
          }, 500);
      });
    }

    const shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.innerHTML = '<style>@import url("styles/rwc-styles.css")</style>'
    + '<style>@import url("styles/rwc-user-styles.css")</style><img id="'
    + this.dataset.id + '" class="' + this.rwcClass
    + '" src="' + this.getAttribute("src") + '"></img>';

    toggleableComponents.push(this);
  }

  set disabled(bool){
    this.isDisabled = bool;

    if (this.isDisabled) {
      if (this.hasAttribute("data-disabled-class")) {
        this.rwcClass = this.dataset.disabledClass;
      } else {
        this.rwcClass = "rwc-img-action-start-disabled";
      }
    } else {
      if (this.hasAttribute("data-class")) {
        this.rwcClass = this.dataset.class;
      } else {
        this.rwcClass = "rwc-img-action-start";
      }
    }

    this.shadowRoot.querySelector("img").setAttribute("class", this.rwcClass);

  }

  get disabled(){
    return this.isDisabled;
  }

  disable(){
    if (!window.rwcDisabledComponents.includes(this)){
      window.rwcDisabledComponents.push(this);
    }
    this.disabled = true;
  }

  enable(){
    this.disabled = false;
    window.rwcDisabledComponents = [];
    toggleableComponents.forEach(function(element){
      if (element.disabled == true) {
        window.rwcDisabledComponents.push(element);
      }
    });

    if (this.dataset.disabled){
      if (!(startDisabledEnabledComponentIDs.includes(this.dataset.id))){
        startDisabledEnabledComponentIDs.push(this.dataset.id);
      }
    }

    startDisabledEnabledTopicString.data = JSON.stringify(startDisabledEnabledComponentIDs);
    startDisabledEnabledTopic.publish(startDisabledEnabledTopicString);

    var index = disabledComponentIDs.indexOf(this.dataset.id);
    if (index > -1){
      disabledComponentIDs.splice(index, 1);
    }
    disabledTopicString.data = JSON.stringify(disabledComponentIDs);
    disabledTopic.publish(disabledTopicString);
  }
}

customElements.define("rwc-img-action-start", rwcImageActionStart);


// --- Listener Components ---
async function prepareListenerData (listener, listenerComponent = null, fieldSelector = null){
  rwcListenerData = await awaitListenerData(listener, listenerComponent, fieldSelector);
  return rwcListenerData;
}

// Promise returns value 50ms after subscribing to topic,
// preventing old or undefined values from being returned
function awaitListenerData(listener, listenerComponent = null, fieldSelector = null){
  return new Promise(function(resolve) {
    setTimeout(function(){
      if (Object.keys(listeners).includes(listener)){
        rwcListenerData = listeners[listener](listenerComponent)
      }
      else {
        rwcListenerCustom(listenerComponent, fieldSelector);
      }
      resolve(rwcListenerData);
    }, 50);
  });
}

// Class for custom element 'rwc-text-listener'
class rwcTextListener extends HTMLElement {
  connectedCallback() {
    const shadowRoot = this.attachShadow({ mode: "open" });

    setTimeout(this.update, 50);
    if (this.dataset.live == "true" || this.dataset.live == null) {
      liveListenerComponents.push(this);
    }
    else {
      staticListenerComponents.push(this);
    }
  }

  update() {
    if (configJSON != null && this.dataset != null){
      prepareListenerData(this.dataset.listener, this, this.dataset.fieldSelector);
    }
  }
}

customElements.define("rwc-text-listener", rwcTextListener);


// // Class for custom element 'rwc-text-custom-listener'
// class rwcTextCustomListener extends HTMLElement {
//   connectedCallback() {
//     const shadowRoot = this.attachShadow({ mode: "open" });

//     setTimeout(this.update, 50);
//     if (this.dataset.live == "true" || this.dataset.live == null) {
//       liveListenerComponents.push(this);
//     }
//     else {
//       staticListenerComponents.push(this);
//     }
//   }

//   update() {
//     if (this.dataset != null){
//       var thisListener = this;
//       prepareCustomListenerData(this.dataset.listener).then(function(result){
//         if (String(result) != "[object Promise]"){
//           thisListener.shadowRoot.innerHTML = "<span>" + String(result) +"</span>";
//         } else {
//           thisListener.shadowRoot.innerHTML = "<span></span>";
//         }
//       });
//     }
//   }
// }

// // Listener function 'rwcListenerGetCustomData'
// async function rwcListenerGetCustomData(listener, msgName = "data"){
//   rwcNode = await subCustomListenerData(listener, msgName);

//   return rwcNode;
// }

// // Promise returns value 50ms after subscribing to topic,
// // preventing old or undefined values from being returned
// function subCustomListenerData(listener, msgName){
//   return new Promise(function(resolve) {
//     listener.subscribe(function(message) {
//       msgNameArray = msgName.split("\.");
//       console.log(msgNameArray);
//       rwcListenerData = message[msgName];
//       listener.unsubscribe();
//       setTimeout(function(){
//         resolve(rwcListenerData);
//       }, 50);
//     });
//   });
// }

// async function prepareCustomListenerData (listener){
//   rwcListenerData = await awaitCustomListenerData(listener);
//   return rwcListenerData;
// }

// // Promise returns value 50ms after subscribing to topic,
// // preventing old or undefined values from being returned
// function awaitCustomListenerData(listener){
//   return new Promise(function(resolve) {
//     setTimeout(function(){
//       rwcListenerData = listeners[listener]()
//       resolve(rwcListenerData);
//     }, 50);
//   });
// }

// customElements.define("rwc-text-custom-listener", rwcTextCustomListener);