const bitcoin = require("bitcoinjs-lib-zcash");
const reverse = require("buffer-reverse")
const filterConsole = require('filter-console');
filterConsole([/^\[trezor-link].*/]);

console.log("trezor-link ...........")

const trezor = require('trezor.js');

const list = new trezor.DeviceList({ debug: true });
const debug = true;

const hardeningConstant = 0x80000000;
const path = [
  (44 | hardeningConstant) >>> 0,
  (1 | hardeningConstant) >>> 0,
  (0 | hardeningConstant) >>> 0,
  0,
  0
];
const info = {
  inputs: [{
    hash: reverse(Buffer.from("3b318325e39094ca99ac6ca1f2031f8e1a4af565b210c66885bdebfbd3e46a77", "hex")),
    index: 0,
    path
  }],
  outputs: [
    {
      value: 900000,
      address: "mqj6dQ2gxY4ZgGYvD5LDN3L13yA1L52EEX"
    }
  ]
}

const raw = "020000000248ca611052da1ecdd8cd988338ddc91a1835ec593b2a468d464ff0d174ab2166010000006b483045022100e8a58d62ad7aeeb38de24682510f6894de16a6c4993c3a61d4b99a568e8684e2022043b9a2845f2e0281539fcb2518f6fc7f97bf524c63a3ea6bf62e50a8280102150121034054cbf47712cb313eeba19d52941008fdf8460481049985221e0fc5a3e7e889000000006cda9ec20e3298876b0ba9874ee1b6b66f1f12deec4fbf8dbd791f6e82b227f6010000006b483045022100f238e3180d463b32d1188749faae0df579ca38e898f8f38a4bd5bf83f918365e022074036e31d8b41d4a5a3a83665073ff9ce16978b874672f90e9342d893ea8200d0121034054cbf47712cb313eeba19d52941008fdf8460481049985221e0fc5a3e7e889000000000240420f00000000001976a914701b7d562f80c8ed5a0b2456e9778bd37447dba288ac181f0f00000000001976a9146ffd34b262b5099b80f8e84fe7e5dccaa79e2e7a88ac00000000";
const refTxs = [bitcoin.Transaction.fromHex(raw)];
const network = bitcoin.networks.testnet;

list.on('connect', function (device) {
  if (debug) {
    console.log('Connected a device:', device);
    console.log('Devices:', list.asArray());
  }
  console.log("Connected device ");

  // For convenience, device emits 'disconnect' event on disconnection.
  device.on('disconnect', function () {
    if (debug) {
      console.log('Disconnected an opened device');
    }
  });

  device.on('button', function (code) {
    buttonCallback(device.features.label, code);
  });
  device.on('passphrase', passphraseCallback);
  device.on('pin', pinCallback);

  // You generally want to filter out devices connected in bootloader mode:
  if (device.isBootloader()) {
    throw new Error('Device is in bootloader mode, re-connected it');
  }


  // Ask the device to show first address of first account on display and return it
  return device.waitForSessionAndRun(function (session) {
    return session.signBjsTx(info, refTxs, [], "testnet", network);
  })
    .then(function (result) {
      console.log("result", result)
      const txb = bitcoin.TransactionBuilder.fromTransaction(result, network)
      console.log(txb)
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
