'use strict';

const assert = require('bsert');
const TX = require('../lib/primitives/tx');
const random = require('bcrypto/lib/random');
const Address = require('../lib/primitives/address');
const consensus = require('../lib/protocol/consensus');
const FullNode = require('../lib/node/fullnode');
const plugin = require('../lib/wallet/plugin');
const {testdir, rimraf, forValue} = require('../test/util/common');
const {wallet} = require('../lib/bcoin-browser');
const Amount = require('../lib/btc/amount');
const {getMinFee} = require('../lib/protocol/policy');

const tiny = require('./json/scenarios/bustabit-2019-2020-tiny-hot-wallet.json');

const run = async () => {
  const prefix = testdir('coinselection');
  const node = new FullNode({
    prefix,
    network: 'regtest'
  });
  node.use(plugin);
  const {wdb} = node.plugins.walletdb;
  let miner, minerAddr;
  let alice;

  const actualCoinbaseMaturity = consensus.COINBASE_MATURITY;
  consensus.COINBASE_MATURITY = 0;
  await node.open();

  // create a miner address
  miner = await wdb.create();
  minerAddr = await miner.receiveAddress();

  alice = await wdb.create();

  // mine blocks to fund miner
  const blocks = 2600;
  await node.rpc.mineBlocks(blocks, minerAddr);
  await forValue(node.chain, 'height', blocks);
  await forValue(wdb, 'height', node.chain.height);

  let sent = 0;
  let receive = 0;
  let i = 0;
  let feeAlice = 0;
  let feeMiner = 0;

  // start simulation
  for (const scene of tiny) {
    let value = Amount.value(scene.value);
    const rate = Amount.value(scene.rate);
    if (Math.abs(value) < 500)
      continue;
    if (value > 0) {
      const address = await alice.receiveAddress();
      receive += value
      const tx = await miner.send({
        outputs: [{value, address}],
        rate,
        useSelectEstimate: true
      });
      const size = tx.getVirtualSize();
      feeMiner += getMinFee(size, rate);
    } else {
      const address = await miner.receiveAddress();
      value = -value;
      sent += value
      const tx = await alice.send({
        outputs: [{value, address}],
        rate,
        useSelectEstimate: true
      });
      const size = tx.getVirtualSize();
      feeAlice += getMinFee(size, rate);
    }
    if (i % 100 === 0)
      console.log(`Done ${i} of ${tiny.length}!!`);
    await node.rpc.mineBlocks(1, minerAddr);
    i++;
  }

  console.log("Total received:", receive);
  console.log("Total sent:", sent);
  console.log("Total fee:", feeMiner + feeAlice);
  console.log("Total fee by Alice:", feeAlice);
  console.log("Total fee by Miner:", feeMiner);
  console.log(await alice.getBalance());


  await node.close();
  await rimraf(prefix);
  consensus.COINBASE_MATURITY = actualCoinbaseMaturity;
}

run();
