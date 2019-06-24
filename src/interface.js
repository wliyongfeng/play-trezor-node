const reverse = require("buffer-reverse")
const bs58check = require('bs58check');
const bitcoin = require("bitcoinjs-lib-zcash");
const trezor = require('trezor.js');
const list = new trezor.DeviceList({ debug: false });
const bitcore = require("bitcore-lib");

const debug = true;

function getPubKeysFromRedeemScript(redeemScript) {
  const script = bitcore.Script.fromString(redeemScript);
  const m = script.chunks[0].opcodenum - 80;
  const pubs = script.chunks.slice(1, script.chunks.length - 2).map(chunk => chunk.buf.toString('hex'))

  return [m, pubs];
}

const hardeningConstant = 0x80000000;
const mainnetPath = [
  (45 | hardeningConstant) >>> 0,
  (0 | hardeningConstant) >>> 0,
  (0 | hardeningConstant) >>> 0,
  0,
  0
];
const testnetPath = [
  (45 | hardeningConstant) >>> 0,
  (1 | hardeningConstant) >>> 0,
  (0 | hardeningConstant) >>> 0,
  0,
  0
];

let nowDevice = null;

const raw = "02000000013b0a8c6821e1a5b131342e6b73300ae264f43409969e307985f14802a26aaf330000000000ffffffff01a0bb0d00000000001976a9146ffd34b262b5099b80f8e84fe7e5dccaa79e2e7a88ac00000000";
const inputsArr = [{raw: "020000000274e5c1511ef978426cfcf17582f8b00f3738c27d1d78de95533348d5ed5295b4000000006b483045022100d418e793393baa083a5313d1b32b8cbf3896f97e187243743e1c45f0adbe94e702202cc1fb6a10a309dfa33fc7b95c9181dfcc82daccdfc23b1e3f29ed053460881c0121034054cbf47712cb313eeba19d52941008fdf8460481049985221e0fc5a3e7e88900000000776ae4d3fbebbd8568c610b265f54a1a8e1f03f2a16cac99ca9490e32583313b010000006a473044022004c3ac43d47d269fa144c290650e43977cbd173d303fefbf1a8becb0c0fa29b502201e63578a15a4ac4b3cae8cba4bfd3fc78d2910f738ff3d8d95769c189d530a5f0121034054cbf47712cb313eeba19d52941008fdf8460481049985221e0fc5a3e7e889000000000240420f000000000017a9142944aac6e59e6e75619cf7962a9236ae5993a7ce8738790d00000000001976a9146ffd34b262b5099b80f8e84fe7e5dccaa79e2e7a88ac00000000"}]
const redeemScript = "5121029075b3ff5b6d80dee7a3d6cbc22fa9dfe34fff39352066f6a0d0de0b52d1963a21021a0168589b29834061267f6f9e884763ac0557302bf2676674205814230e6c9352ae";

list.on('connect', async function (device) {
  nowDevice = device;

  device.on('disconnect', function () {
    if (debug) {
      device = null
    }
  });

  device.on('button', function (code) {
    buttonCallback(device.features.label, code);
  });
  device.on('passphrase', passphraseCallback);
  device.on('pin', pinCallback);

  await sign(raw, inputsArr, redeemScript, "testnet");
})

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

function constructInputs(tx, multisig, network = "mainnet") {
  return tx.ins.map(input => {
    return {
      address_n: network === "mainnet" ? mainnetPath : testnetPath,
      script_type: 'SPENDMULTISIG',
      prev_index: input.index,
      prev_hash: reverse(input.hash).toString('hex'),
      multisig
    }
  })
}

function constructMultisig(pubKeys, devicePubKey, deviceXpub, signatures, m, network = "mainnet") {
  const net = network === "mainnet" ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
  function getNode(xpub) {
    const hd = bitcoin.HDNode.fromBase58(xpub, net);
    return {
      depth: hd.depth,
      child_num: hd.index,
      fingerprint: hd.parentFingerprint,
      public_key: hd.keyPair.getPublicKeyBuffer().toString('hex'),
      chain_code: hd.chainCode.toString('hex'),
    };
  }

  function getDefaultXpub(pub) {
    const chaincode = Buffer.from("0000000000000000000000000000000000000000000000000000000000000000", "hex");

    const buffer = Buffer.allocUnsafe(78);
    buffer.writeUInt32BE(net.bip32.public, 0);
    buffer.writeUInt8(0, 4);
    buffer.writeUInt32BE(0x00000000, 5);
    buffer.writeUInt32BE(0x00000000, 9);
    chaincode.copy(buffer, 13);
    Buffer.from(pub, 'hex').copy(buffer, 45);

    return bs58check.encode(buffer);
  }

  const nonDevicePubs = pubKeys.filter(pub => pub !== devicePubKey);
  const pubkeys = nonDevicePubs.map(pub => {
    return {
      node: getNode(getDefaultXpub(pub)),
      address_n: []
    }
  })

  pubkeys.push({node: getNode(deviceXpub), address_n: []})

  return {
    pubkeys,
    signatures,
    m
  }
}

async function getDeviceXpub(network = "mainnet") {
  const coin = network === "mainnet" ? "bitcoin" : "testnet";
  const path = network === "mainnet" ? mainnetPath : testnetPath;
  const result = await nowDevice.waitForSessionAndRun(function (session) {
    return session.getPublicKey(path, coin)
  })

  return [result.message.node.public_key, result.message.xpub]
}

async function getMultisigObj(txb, redeemScript, network = "mainnet") {
  const [devicePubKey, deviceXpub] = await getDeviceXpub(network);
  const [m, pubs] = getPubKeysFromRedeemScript(redeemScript);
  const signatures = getSignatures(txb, pubs);
  return constructMultisig(pubs, devicePubKey, deviceXpub, signatures, m, network);
}

function getSignatures(txb, pubs) {
  if (txb.inputs[0].signatures) {
    return txb.inputs[0].signatures.map(sig => {
      return sig ? sig.toString("hex") : "";
    })
  }
  return pubs.map(pub => "");
}

function constructOutputs(raw, network = "mainnet") {
  const tx = bitcore.Transaction(raw);
  const net = network === "mainnet" ? bitcore.Networks.mainnet : bitcore.Networks.testnet;
  return tx.outputs.map(output => {
    const address = bitcore.Address.fromScript(output.script, net).toString();
    return {
      amount: output.satoshis,
      address,
      script_type: 'PAYTOADDRESS'
    }
  })
}

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

function constructPreTxs(inputsArr) {
  return inputsArr.map(input => bitcoin.Transaction.fromHex(input.raw)).map(bjsTx2refTx)
}

async function sign(raw, inputsArr, redeemScript, network = "mainnet") {
  if (!nowDevice) {
    throw new Error("No device");
  }

  const transaction = bitcoin.Transaction.fromHex(raw);
  const txb = bitcoin.TransactionBuilder.fromTransaction(
    transaction,
    network === "mainnet" ? bitcoin.networks.bitcoin : bitcoin.networks.testnet
  );

  const multisig = await getMultisigObj(txb, redeemScript, network);
  const inputs = constructInputs(transaction, multisig, network);
  const outputs = constructOutputs(raw, network);
  const txs = constructPreTxs(inputsArr);

  try {
    const signResult = await nowDevice.waitForSessionAndRun(function (session) {
      return session.signTx(inputs, outputs, txs, network === "mainnet" ? "bitcoin" : "testnet");
    })

    console.log("sign result", signResult)
  } catch (e) {
    console.error('sign error', e)
  }
}
