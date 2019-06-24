const bitcoin = require("bitcoinjs-lib-zcash");
const reverse = require("buffer-reverse")
const filterConsole = require('filter-console');
filterConsole([/^\[trezor-link].*/]);

const network = bitcoin.networks.testnet;

console.log("trezor-link ...........")

function getNode(xpub) {
  const hd = bitcoin.HDNode.fromBase58(xpub, network);
  return {
    depth: hd.depth,
    child_num: hd.index,
    fingerprint: hd.parentFingerprint,
    public_key: hd.keyPair.getPublicKeyBuffer().toString('hex'),
    chain_code: hd.chainCode.toString('hex'),
  };
}

const trezor = require('trezor.js');

const list = new trezor.DeviceList({ debug: false });
const debug = true;

const hardeningConstant = 0x80000000;
const path = [
  (45 | hardeningConstant) >>> 0,
  (1 | hardeningConstant) >>> 0,
  (0 | hardeningConstant) >>> 0,
  0,
  0
];

const multisig = {
  pubkeys: [
    {
      node: getNode("tpubDH8Yi5vViTRqpeVPRxEfvmxGdxkcpECmoSJxvVPRjMiYPqTnCGEnf9DLKpD6ynuNCif7U6pGgZAbbZD7N6VoRLyUENv57GvJBAjRvE7ejfD"),
      address_n: [],
    },
    {
      node: getNode("tpubD6NzVbkrYhZ4WLczPJWReQycCJdd6YVWXubbVUFnJ5KgU5MDQrD998ZJLSMYL4tvPbyA8TgRRbz63nws1UVmGpSu8L1TtcApQZ5P1MqBpDw"),
      address_n: [],
    }
  ],
  signatures: ["", ""],
  m: 1
}

const inputs = [{
  address_n: path,
  prev_index: 0,
  prev_hash: '33af6aa20248f18579309e960934f464e20a30736b2e3431b1a5e121688c0a3b',
  multisig,
  script_type: 'SPENDMULTISIG',
}];

const outputs = [
  {
    amount: 900000,
    address: "mqj6dQ2gxY4ZgGYvD5LDN3L13yA1L52EEX",
    script_type: 'PAYTOADDRESS'
  }
];

const raw = "020000000274e5c1511ef978426cfcf17582f8b00f3738c27d1d78de95533348d5ed5295b4000000006b483045022100d418e793393baa083a5313d1b32b8cbf3896f97e187243743e1c45f0adbe94e702202cc1fb6a10a309dfa33fc7b95c9181dfcc82daccdfc23b1e3f29ed053460881c0121034054cbf47712cb313eeba19d52941008fdf8460481049985221e0fc5a3e7e88900000000776ae4d3fbebbd8568c610b265f54a1a8e1f03f2a16cac99ca9490e32583313b010000006a473044022004c3ac43d47d269fa144c290650e43977cbd173d303fefbf1a8becb0c0fa29b502201e63578a15a4ac4b3cae8cba4bfd3fc78d2910f738ff3d8d95769c189d530a5f0121034054cbf47712cb313eeba19d52941008fdf8460481049985221e0fc5a3e7e889000000000240420f000000000017a9142944aac6e59e6e75619cf7962a9236ae5993a7ce8738790d00000000001976a9146ffd34b262b5099b80f8e84fe7e5dccaa79e2e7a88ac00000000";
const txs = [bitcoin.Transaction.fromHex(raw)].map(bjsTx2refTx);

function bjsTx2refTx(tx) {
  const extraData = tx.getExtraData();
  return {
    lock_time: tx.locktime,
    version: tx.isDashSpecialTransaction() ? tx.version | tx.dashType << 16 : tx.version,
    hash: tx.getId(),
    inputs: tx.ins.map(function (input) {
      return {
        prev_index: input.index,
        sequence: input.sequence,
        prev_hash: reverse(input.hash).toString('hex'),
        script_sig: input.script.toString('hex')
      };
    }),
    bin_outputs: tx.outs.map(function (output) {
      return {
        amount: output.value,
        script_pubkey: output.script.toString('hex')
      };
    }),
    extra_data: extraData ? extraData.toString('hex') : null,
    version_group_id: tx.isZcashTransaction() ? parseInt(tx.versionGroupId, 16) : null
  };
}

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
    return session.signTx(inputs, outputs, txs, "testnet");
  })
    .then(function (result) {
      console.log("result", result)
      const tx = bitcoin.Transaction.fromHex(result.message.serialized.serialized_tx);
      const txb = bitcoin.TransactionBuilder.fromTransaction(tx, network)
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
