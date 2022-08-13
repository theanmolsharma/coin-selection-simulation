'use strict';

const assert = require('bsert');
const consensus = require('../lib/protocol/consensus');
const FullNode = require('../lib/node/fullnode');
const plugin = require('../lib/wallet/plugin');
const {testdir, rimraf, forValue} = require('../test/util/common');
const Amount = require('../lib/btc/amount');
const {getMinFee} = require('../lib/protocol/policy');
const fs = require('fs/promises');

let data;
const file = `report-${Date.now()}.txt`;

const run = async (useSelectEstimate) => {
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
  for (const scene of data) {
    let value = Amount.value(scene.value);
    let rate;
    if (scene.rate)
      rate = Amount.value(scene.rate);
    else
      rate = 5000;

    if (Math.abs(value) < 500)
      continue;
    if (value > 0) {
      const address = await alice.receiveAddress();
      receive += value;

      const tx = await miner.send({
        outputs: [{value, address}],
        rate,
        useSelectEstimate
      });

      const size = tx.getVirtualSize();
      feeMiner += getMinFee(size, rate);
    } else {
      const address = await miner.receiveAddress();
      value = -value;
      sent += value;

      const tx = await alice.send({
        outputs: [{value, address}],
        rate,
        useSelectEstimate
      });

      const size = tx.getVirtualSize();
      feeAlice += getMinFee(size, rate);
    }

    if (i % 100 === 0)
      console.log(`Done ${i} of ${data.length}!!`);
    if (i % 20)
      await node.rpc.mineBlocks(1, minerAddr);

    i++;
  }

  console.log("Total received:", receive);
  console.log("Total sent:", sent);
  console.log("Total fee:", feeMiner + feeAlice);
  console.log("Total fee by Alice:", feeAlice);
  console.log("Total fee by Miner:", feeMiner);
  console.log(await alice.getBalance());
  await fs.appendFile(file, `Total received: ${receive}\n`, err => {});
  await fs.appendFile(file, `Total sent: ${sent}\n`, err => {});
  await fs.appendFile(file, `Total fee: ${feeMiner + feeAlice}\n`, err => {});
  await fs.appendFile(file, `Total fee by Alice: ${feeAlice}\n`, err => {});
  await fs.appendFile(file, `Total fee by Miner: ${feeMiner}\n`, err => {});
  let balance = await alice.getBalance();
  await fs.appendFile(file, `Balance: ${balance.unconfirmed}\n`, err => {});
  await fs.appendFile(file, `Coins:¸ ${balance.coin}\n`, err => {});

  await node.close();
  await rimraf(prefix);
  consensus.COINBASE_MATURITY = actualCoinbaseMaturity;
}


(async () => {
  assert(process.argv.length > 2, 'Please pass in simulation file');
  data = require(`./json/${process.argv[2]}`);
  console.log(`Starting simulation on ${process.argv[2]}`);
  await fs.writeFile(file, `Starting simulation on ${process.argv[2]}\n`, {flag: 'w+'}, err => {
  });
  for (const useSelectEstimate of [true, false]) {
    if (useSelectEstimate) {
      console.log('Running simulation on old selection');
      await fs.appendFile(file, 'Running simulation on old selection\n', err => {});
    } else {
      console.log('Running simulation on new selection');
      await fs.appendFile(file, 'Running simulation on new selection\n', err => {});
    }
    await run(useSelectEstimate);
  }
})().then(() => {
  console.log('Simulation complete.');
  process.exit(0);
}).catch((err) => {
  console.error(err.stack);
  process.exit(1);
});
