(function(ext) {

  var START_MSG = 0xF0;
  var END_MSG = 0xF7;

  var MOTOR_PIN_1 = 9;
  var MOTOR_PIN_2 = 10;
  var MOTOR_PIN_3 = 11;
  var MOTOR_PIN_4 = 12;
  
  var parsingMsg = false;
  var msgBytesRead = 0;
  var storedMsg = new Uint8Array(1024);

  var connected = false;
  var device = null;
  var poller = null;

  /* TEMPORARY WORKAROUND
     this is needed since the _deviceRemoved method
     is not called when serial devices are unplugged*/
  var sendAttempts = 0;

  var pingCmd = new Uint8Array(1);
  pingCmd[0] = 1;

  var inputVals = { d0: 0, a0: 0, a1: 0 };
  var outputPins = { d2: 2, d3: 3, d5: 5, d9: 9, d10: 10, d11: 11, d12: 12 };

  var stepNumber = 0;
  
  function processMsg() {
    inputVals.d0 = storedMsg[0] | (storedMsg[1] << 0x08);
    inputVals.a0 = storedMsg[2] | (storedMsg[3] << 0x08);
    inputVals.a1 = storedMsg[4] | (storedMsg[5] << 0x08);
  }

  function processInput(data) {
    for (var i=0; i < data.length; i++) {
      if (parsingMsg) {
        if (data[i] == END_MSG) {
          parsingMsg = false;
          processMsg();
        } else {
          storedMsg[msgBytesRead++] = data[i];
        }
      } else {
        if (data[i] == START_MSG) {
          parsingMsg = true;
          msgBytesRead = 0;
        }
      }
    }
  }

  ext.analogRead = function(pin) {
    return inputVals[pin];
  };

  ext.digitalRead = function(pin) {
    if (inputVals[pin] > 0) return true;
    return false;
  };
  
  ext.analogWrite = function(pin, val) {
    var output = new Uint8Array(3);
    output[0] = 2;
    output[1] = outputPins[pin];
    output[2] = val;
    device.send(output.buffer);
  };

  ext.digitalWrite = function(pin, val) {
    var output = new Uint8Array(3);
    output[0] = 3;
    output[1] = outputPins[pin];
    if (val === 'on')
      output[2] = 1;
    else
      output[2] = 0;
    device.send(output.buffer);
  };

  ext.setPixelColor = function(pixel, red, green, blue) {
    var output = new Uint8Array(5);
    output[0] = 4;
    output[1] = pixel;
    output[2] = red;
    output[3] = green;
    output[4] = blue;
    device.send(output.buffer);
  };
  
  ext.stepMotor = function() {
    switch (currentStep) {
        case 0:
          ext.digitalWrite(MOTOR_PIN_1, 'on');
          ext.digitalWrite(MOTOR_PIN_2, 'off');
          ext.digitalWrite(MOTOR_PIN_3, 'off');
          ext.digitalWrite(MOTOR_PIN_4, 'off');
          break;
        case 1:
          ext.digitalWrite(MOTOR_PIN_1, 'on');
          ext.digitalWrite(MOTOR_PIN_2, 'on');
          ext.digitalWrite(MOTOR_PIN_3, 'off');
          ext.digitalWrite(MOTOR_PIN_4, 'off');
          break;
        case 2:
          ext.digitalWrite(MOTOR_PIN_1, 'off');
          ext.digitalWrite(MOTOR_PIN_2, 'on');
          ext.digitalWrite(MOTOR_PIN_3, 'off');
          ext.digitalWrite(MOTOR_PIN_4, 'off');
          break;
        case 3:
          ext.digitalWrite(MOTOR_PIN_1, 'off');
          ext.digitalWrite(MOTOR_PIN_2, 'on');
          ext.digitalWrite(MOTOR_PIN_3, 'on');
          ext.digitalWrite(MOTOR_PIN_4, 'off');
          break;
        case 4:
          ext.digitalWrite(MOTOR_PIN_1, 'off');
          ext.digitalWrite(MOTOR_PIN_2, 'off');
          ext.digitalWrite(MOTOR_PIN_3, 'on');
          ext.digitalWrite(MOTOR_PIN_4, 'off');
          break;
        case 5:
          ext.digitalWrite(MOTOR_PIN_1, 'off');
          ext.digitalWrite(MOTOR_PIN_2, 'off');
          ext.digitalWrite(MOTOR_PIN_3, 'on');
          ext.digitalWrite(MOTOR_PIN_4, 'on');
          break;
        case 6:
          ext.digitalWrite(MOTOR_PIN_1, 'off');
          ext.digitalWrite(MOTOR_PIN_2, 'off');
          ext.digitalWrite(MOTOR_PIN_3, 'off');
          ext.digitalWrite(MOTOR_PIN_4, 'on');
          break;
        case 7:
          ext.digitalWrite(MOTOR_PIN_1, 'on');
          ext.digitalWrite(MOTOR_PIN_2, 'off');
          ext.digitalWrite(MOTOR_PIN_3, 'off');
          ext.digitalWrite(MOTOR_PIN_4, 'on');
          break;
        default:
          break;
      }
      currentStep += 1;
      if (currentStep == 8) {
        currentStep = 0;
      } else if (currentStep == -1) {
        currentStep = 7;
      }    
  }
  
  ext.whenAnalogRead = function(pin, op, val) {
    if (op === '>')
      return inputVals[pin] > val;
    else if (op === '<')
      return inputVals[pin] < val;
    else if (op === '=')
      return inputVals[pin] === val;
    else
      return false;
  };

  ext.whenDigitalRead = function(pin, val) {
    if (val === 'on')
      return ext.digitalRead(pin);
    else
      return ext.digitalRead(pin) === false;
  };

  ext.mapValues = function(val, aMin, aMax, bMin, bMax) {
    var output = (((bMax - bMin) * (val - aMin)) / (aMax - aMin)) + bMin;
    return Math.round(output);
  };
 
  ext._getStatus = function() {
    if (!connected)
      return { status:1, msg:'Disconnected' };
    else
      return { status:2, msg:'Connected' };
  };

  ext._deviceRemoved = function(dev) {
    // Not currently implemented with serial devices
  };

  var poller = null;
  ext._deviceConnected = function(dev) {
    sendAttempts = 0;
    connected = true;
    if (device) return;
    
    device = dev;
    device.open({ stopBits: 0, bitRate: 38400, ctsFlowControl: 0 });
    device.set_receive_handler(function(data) {
      sendAttempts = 0;
      var inputData = new Uint8Array(data);
      processInput(inputData);
    }); 

    poller = setInterval(function() {

      /* TEMPORARY WORKAROUND
         Since _deviceRemoved is not
         called while using serial devices */
      if (sendAttempts >= 10) {
        connected = false;
        device.close();
        device = null;
        clearInterval(poller);
        return;
      }
      
      device.send(pingCmd.buffer); 
      sendAttempts++;

    }, 50);

  };

  ext._shutdown = function() {
    ext.digitalWrite(d2, 'off');
    ext.digitalWrite(d3, 'off');
    ext.digitalWrite(d5, 'off');
    ext.digitalWrite(d9, 'off');
    ext.digitalWrite(d10, 'off');
    ext.digitalWrite(d11, 'off');
    ext.digitalWrite(d12, 'off');
    ext.setPixelColor(1, 0, 0, 0);
    ext.setPixelColor(2, 0, 0, 0);
    ext.setPixelColor(3, 0, 0, 0);
    ext.setPixelColor(4, 0, 0, 0);
    ext.setPixelColor(5, 0, 0, 0);
    ext.setPixelColor(6, 0, 0, 0);
    ext.setPixelColor(7, 0, 0, 0);
    ext.setPixelColor(8, 0, 0, 0);
    ext.setPixelColor(9, 0, 0, 0);
    ext.setPixelColor(10, 0, 0, 0);
    ext.setPixelColor(11, 0, 0, 0);
    ext.setPixelColor(12, 0, 0, 0);
    if (device) device.close();
    if (poller) clearInterval(poller);
    device = null;
  };

  var descriptor = {
    blocks: [
      [' ', 'set %m.outDPins %m.dOutp', 'digitalWrite', 'd1', 'on'],
      [' ', 'set %m.outAPins to %n', 'analogWrite', 'd5', '255'],
      [' ', 'set pixel %n to red:%n, green:%n, blue:%n', 'setPixelColor', 1, 255, 0, 0],
      ['b', 'read %m.inDPins', 'digitalRead', 'd0'],
      ['r', 'read %m.inAPins', 'analogRead', 'a0'],
      ['h', 'when %m.inDPins is %m.dOutp', 'whenDigitalRead', 'd0', 'on'],
      ['h', 'when %m.inAPins is %m.ops %n', 'whenAnalogRead', 'a0', '>', '100'],
      ['r', 'map %n from %n %n to %n %n', 'mapValues', 500, 0, 1023, 0, 255]
    ],
    menus: {
      outDPins: ['d2', 'd3', 'd5', 'd9', 'd10', 'd11', 'd12'],
      outAPins: ['d3', 'd5', 'd9', 'd10', 'd11', 'd12'],
      inDPins: ['d0', 'a0', 'a1'],
      inAPins: ['a0', 'a1'],
      dOutp: ['on', 'off'],
      ops: ['>', '=', '<']
    },  
    url: 'http://camstevens.github.io/arduino-extension'
  };

  ScratchExtensions.register('ScratchDuino', descriptor, ext, {type:'serial'});

})({});
