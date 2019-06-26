# roswebcomponents
A JavaScript library for rapid development of ROS connected web interfaces

This library provides custom HTML UI components which interface with JavaScript functions to abstract [roslibjs](https://github.com/RobotWebTools/roslibjs), simplifying publishing and subscribing to topics down to making a one-line JS function call, or simply writing a HTML tag, for a set of common robot behaviours and data sources. The functions are split into two categories:
1. Action functions, which trigger robot behaviours.
2. Listener functions, which return data from the robot.

Action functions:
 - rwcActionSetPoseRelative
    - Arguments: `x, y, z, quaternion = {x: 0, y: 0, z: 0, w: 1}`
    - Description: Tells the robot to move to a new pose relative to its current pose.
    - Example: `rwcActionSetPoseRelative(1, 0, 0);`
        - Tells the robot to move forward 1m. 
 - rwcActionSetPoseMap
    - Arguments: x, y, z, quaternion = {x: 0, y: 0, z: 0, w: 1}
    - Description: Tells the robot to move to a new pose relative to the origin of its map.
    - Example: `rwcActionSetPoseMap(5, 5, 0);`
        - Tells the robot to move to x: 5, y: 5 in its metric map. 
 - rwcActionGoToNode
    - Arguments: `node_name, no_orientation = false`
    - Description: Tells the robot to move the topological node '`node_name`'.
    - Example: `rwcActionGoToNode("WayPoint32");`
        - Tells the robot to move to the topological node 'WayPoint32'. 
 - rwcActionVolumePercentChange
    - Arguments: `percentage_change`
    - Description: Changes the master audio volume of the robot's speaker by `percentage_change` percent.
    - Example: `rwcActionVolumePercentChange(20);`
        - Changes the master audio volume of the robot's speaker by +20%.
    - Example: `rwcActionVolumePercentChange(-100);`
        - Changes the master audio volume of the robot's speaker by -100%, effectively muting the speaker.
 - rwcActionSay
     - Arguments: `phrase`
    - Description: Asks the robot to speak the given `phrase` using TTS (Text To Speech). By default this library uses [MaryTTS](https://github.com/strands-project/strands_ui/tree/hydro-devel/mary_tts), but you can specify an ActionServer name and goal message type for your own TTS ActionServer in `rwc-config.json`.
    - Example: `rwcActionSay("Hello world!");`
        - Tells the robot to speak the phrase "Hello world!" using TTS.