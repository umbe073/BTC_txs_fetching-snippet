import pkg from '@mempool/mempool.js';
import fs from 'fs';


const init = pkg({ network: 'mainnet' });
const { bitcoin } = init;


const SATS_PER_BTC = 100000000;
const TARGET_ADDRESS = 'INSERT BTC ADDRESS HERE';


bitcoin.addresses.getAddressTxs({ address: TARGET_ADDRESS })
 .then(transactions => {
   const csvData = [
     ['Date/Time', 'Transaction ID', 'Amount (BTC)', 'Fee (BTC)', 'From Addresses', 'To Addresses', 'Block Height']
   ];


   transactions.forEach(tx => {
     // Get all input addresses (excluding target)
     const inputAddresses = [
       ...new Set(
         tx.vin
           .map(input => input.prevout?.scriptpubkey_address)
           .filter(addr => addr && addr !== TARGET_ADDRESS)
       )
     ];


     // Get all output addresses (excluding target)
     const outputAddresses = [
       ...new Set(
         tx.vout
           .map(output => output.scriptpubkey_address)
           .filter(addr => addr && addr !== TARGET_ADDRESS)
       )
     ];


     // Calculate received and sent
     const received = tx.vout
       .filter(output => output.scriptpubkey_address === TARGET_ADDRESS)
       .reduce((sum, output) => sum + output.value, 0);


     const sent = tx.vin
       .filter(input => input.prevout?.scriptpubkey_address === TARGET_ADDRESS)
       .reduce((sum, input) => sum + input.prevout.value, 0);


     // Skip transactions with no external interaction
     const hasExternalReceiver = outputAddresses.some(addr => !inputAddresses.includes(addr));
     if (!hasExternalReceiver && received === 0) return;


     // Net amount after fees (subtract fee if the address is the sender)
     const netBTC = (received - sent - (sent > 0 ? tx.fee : 0)) / SATS_PER_BTC;
     const feeBTC = tx.fee / SATS_PER_BTC;


     // Format date/time
     const date = tx.status.block_time
       ? new Date(tx.status.block_time * 1000).toISOString()
       : 'Pending';


     // Determine From/To addresses
     const fromAddresses = inputAddresses.join('; ');
     let toAddresses = outputAddresses
       .filter(addr => !inputAddresses.includes(addr)) // Exclude change addresses
       .join('; ');


     // If the target address is a receiver, include it in To Addresses
     if (received > 0) {
       toAddresses = TARGET_ADDRESS;
     }


     csvData.push([
       date,
       tx.txid,
       netBTC.toFixed(8),
       feeBTC.toFixed(8),
       fromAddresses,
       toAddresses,
       tx.status.block_height || 'Unconfirmed'
     ]);
   });


   // Save CSV
   const csvString = csvData.map(row => row.join(',')).join('\n');
   const filePath = `external_transactions_${TARGET_ADDRESS}.csv`;
   fs.writeFileSync(filePath, csvString);
  
   console.log(`CSV saved to: ${filePath}`);
   console.log('Transactions with external receivers are shown (change addresses excluded).');
 })
 .catch(error => {
   console.error('Error:', error.response?.data || error.message);
 });
