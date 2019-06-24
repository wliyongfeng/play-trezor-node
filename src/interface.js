const bs58check = require('bs58check');
const bitcoin = require("bitcoinjs-lib-zcash");
const trezor = require('trezor.js');
const list = new trezor.DeviceList({ debug: false });
const bitcore = require("bitcore-lib");

function getPubKeysFromRedeemScript(redeemScript) {
  const script = bitcore.Script.fromString(redeemScript);

  return script.chunks.slice(1, script.chunks.length - 2).map(chunk => chunk.buf.toString('hex'));
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

list.on('connect', function (device) {
  device.on('disconnect', function () {
    if (debug) {
      device = null
    }
  });
})

function constructInputs(tx, multisig, network = "mainnet") {
  return tx.ins.map(input => {
    return {
      address_n: network === "mainnet" ? mainnetPath : testnetPath,
      script_type: 'SPENDMULTISIG',
      prev_index: input.index,
      prev_hash: input.hash.toString('hex'),
      multisig
    }
  })
}

function constructMultisig(pubKeys, devicePubKey, deviceXpub, signatures, m) {
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

  function getDefaultXpub(pub) {
    const chaincode = Buffer.from("0000000000000000000000000000000000000000000000000000000000000000", "hex");

    const buffer = Buffer.allocUnsafe(78);
    buffer.writeUInt32BE(network.bip32.public, 0);
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

  pubKeys.push({node: getNode(deviceXpub), address_n: []})

  return {
    pubKeys,
    signatures,
    m
  }
}


async function sign(raw, inputsObj, redeemScript, network = "mainnet") {
  if (!nowDevice) {
    throw new Error("No device");
  }

  const transaction = bitcoin.Transaction.fromHex(raw);
}
