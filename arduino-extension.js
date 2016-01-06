(function(ext) {

    // Status reporting code
    // Use this to report missing hardware, plugin or unsupported browser
    ext._getStatus = function() {
        if(!device) return {status: 1, msg: 'Device not connected'};
        return {status: 2, msg: 'Device connected'};
    }   

    ext.my_first_block = function() {
        // Code that gets executed when the block is run
    };

    // Handle devices when they are connected.  If we don't have an open device, go ahead and open one
    var potentialDevices = [];
    ext._deviceConnected = function(dev) {
        potentialDevices.push(dev);

        // If we're already connected to a device, just return
        if (device) {
            return;
        }
        
        // Since no device is connected, try to connect to the newly discovered device
        tryNextDevice();
    }

    // Handle when a device is disconnected
    ext._deviceRemoved = function(dev) {
        
        // Ignore the disconnect if it is not the device we are connected to
        if(device != dev) return;
        
        //if(poller) poller = clearInterval(poller);
        device = null;
        tryNextDevice();
    };

    // Tries to open the next connected device
  function tryNextDevice() {
    device = potentialDevices.shift();
    if (!device) return;

    device.open({ stopBits: 0, bitRate: 57600, ctsFlowControl: 0 });
    console.log('Attempting connection with ' + device.id);
    device.set_receive_handler(function(data) {
      var inputData = new Uint8Array(data);
//      processInput(inputData);
    });

/*
    poller = setInterval(function() {
      queryFirmware();
    }, 1000);

    watchdog = setTimeout(function() {
      clearInterval(poller);
      poller = null;
      device.set_receive_handler(null);
      device.close();
      device = null;
      tryNextDevice();
    }, 5000);
    */
  }

    // Cleanup function when the extension is unloaded
  ext._shutdown = function() {
    // TODO: Bring all pins down 
    if (device) device.close();
    device = null;
  };    
    // Block and block menu descriptions
    var descriptor = {
        blocks: [
            // Block type, block name, function name
            [' ', 'my first block', 'my_first_block'],
        ]
    };
    
    // Connext to Arduino via Serial
    var serial_info = {type: 'serial'};
    
    // Register the extension
    ScratchExtensions.register('ScratchDuino', descriptor, ext, serial_info);
})({});
