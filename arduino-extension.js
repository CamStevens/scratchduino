(function(ext) {
    var device = null;
    var connected = false;
    
    // Status reporting code
    // Use this to report missing hardware, plugin or unsupported browser
    ext._getStatus = function() {
        if(!connected) return {status: 1, msg: 'Device not connected'};
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
        
        // Try to connect to another device
        tryNextDevice();
    };

    function processSerialInput(buffer) {
        
    }
    
    // Tries to open the next connected device
    var pingTimeoutHandler = null;
    function tryNextDevice() {
        device = potentialDevices.shift();
        if (!device) {
            //
            // No more devices to try
            //
            clearTimeout(pingTimeoutHandler);
            pingTimeoutHandler = null;
            return;
        }

        console.log('Attempting connection with ' + device.id);
        device.open({ stopBits: 0, bitRate: 57600, ctsFlowControl: 0 });

        //
        // Look for "PONG" in our first response
        // If we don't receive that, disconnect and try the next device.  If we do receive that, then update our receive handler
        //
        device.set_receive_handler(function(data) {
            var inputData = new Uint8Array(data);
            console.log('Received ' + inputData + ' from ' + device.id);
            if (inputData[0] == 'P' && inputData[1] == 'O' && inputData[2] == 'N' && inputData[3] == 'G') {
                connected = true;
                console.log('Successfully connected to ' + device.id);
                clearTimeout(pingTimeoutHandler);
                pingTimeoutHandler = null;
                device.set_receive_handler(function(data) {
                    processSerialInput(data);
                });
            } 
        });

        // Send a PING command to try and elicit a PING response (PONG)
        var output = new Uint8Array(['P']);
        device.send(output.buffer);
/*
    poller = setInterval(function() {
      queryFirmware();
    }, 1000);
*/
        // Set up a timeout to disconnect if we don't get a PING response
        pingTimeoutHandler = setTimeout(function() {
            console.log('Connection to ' + device.id + ' failed.  Trying next device.');
            device.set_receive_handler(null);
            device.close();
            device = null;
            tryNextDevice();
        }, 5000);
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
