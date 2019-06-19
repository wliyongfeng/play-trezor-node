const trezor = require('trezor.js');

const list = new trezor.DeviceList({ debug: true });
const debug = true;

list.on('connect', function (device) {
  if (debug) {
    console.log('Connected a device:', device);
    console.log('Devices:', list.asArray());
  }
  console.log("Connected device " + device.features.label);

  // For convenience, device emits 'disconnect' event on disconnection.
  device.on('disconnect', function () {
    if (debug) {
      console.log('Disconnected an opened device');
    }
  });

  device.on('button', function(code) { buttonCallback(device.features.label, code); });
  device.on('passphrase', passphraseCallback);
  device.on('pin', pinCallback);

  // You generally want to filter out devices connected in bootloader mode:
  if (device.isBootloader()) {
    throw new Error('Device is in bootloader mode, re-connected it');
  }

  var hardeningConstant = 0x80000000;

  // Ask the device to show first address of first account on display and return it
  return device.waitForSessionAndRun(function (session) {
    return session.getAddress([
      (44 | hardeningConstant) >>> 0,
      (1 | hardeningConstant) >>> 0,
      (0 | hardeningConstant) >>> 0,
      0,
      0
    ], 'testnet', true)
  })
    .then(function (result) {
      console.log('Address:', result.message.address);
    })

    .catch(function (error) {
      // Errors can happen easily, i.e. when device is disconnected or request rejected
      // Note: if there is general error handler, that listens on device.on('error'),
      // both this and the general error handler gets called
      console.error('Call rejected:', error);
    });
});

function passphraseCallback(callback) {
  console.log('Please enter passphrase.');

  // note - disconnecting the device should trigger process.stdin.pause too, but that
  // would complicate the code

  // we would need to pass device in the function and call device.on('disconnect', ...

  process.stdin.resume();
  process.stdin.on('data', function (buffer) {
    var text = buffer.toString().replace(/\n$/, "");
    process.stdin.pause();
    callback(null, text);
  });
}

function pinCallback(type, callback) {
  console.log('Please enter PIN. The positions:');
  console.log('7 8 9');
  console.log('4 5 6');
  console.log('1 2 3');

  // note - disconnecting the device should trigger process.stdin.pause too, but that
  // would complicate the code

  // we would need to pass device in the function and call device.on('disconnect', ...

  process.stdin.resume();
  process.stdin.on('data', function (buffer) {
    var text = buffer.toString().replace(/\n$/, "");
    process.stdin.pause();
    callback(null, text);
  });
}

function buttonCallback(label, code) {
  if (debug) {
    // We can (but don't necessarily have to) show something to the user, such
    // as 'look at your device'.
    // Codes are in the format ButtonRequest_[type] where [type] is one of the
    // types, defined here:
    // https://github.com/trezor/trezor-common/blob/master/protob/types.proto#L78-L89
    console.log('User is now asked for an action on device', code);
  }
  console.log("Look at device " + label + " and press the button, human.");
}
