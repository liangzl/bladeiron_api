'use strict';

const fs = require('fs');
const path = require('path');
const rpc = require('jayson/promise');
const web3 = require('web3');
const w = new web3(); // for util functions only... :P

class BladeAPI {
	constructor(rpcport, rpchost, options) // options is an object 
	{
		// option import + setup
		this.configs = options;
		this.appName = options.appName;
		this.networkID = options.networkID;
		this.rpcport = rpcport;
		this.rpchost = rpchost;

		this.ready = false;
		this.client;

		// Utilities
		this.toAscii = (input) => { return w.toAscii(input) }
		this.toHex   = (input) => { return w.toHex(input) }
		this.toBigNumber = (input) => { return w.toBigNumber(input) }
		this.toDecimal = (input) => { return w.toDecimal(input) }
		this.toWei = (input, unit = 'ether') => { return w.toWei(input, unit) }
		this.fromWei = (input, unit = 'ether') => { return w.fromWei(input, unit) }

		this.toAddress = address => {
                        let addr = String(this.toHex(this.toBigNumber(address)));

                        if (addr.length === 42) {
                                return addr
                        } else if (addr.length > 42) {
                                throw "Not valid address";
                        }

                        let pz = 42 - addr.length;
                        addr = addr.replace('0x', '0x' + '0'.repeat(pz));

                        return addr;
                }

		this.byte32ToAddress = (b) => { return this.toAddress(this.toHex(this.toBigNumber(String(b)))) }
        	this.byte32ToDecimal = (b) => { return this.toDecimal(this.toBigNumber(String(b))) }
        	this.byte32ToBigNumber = (b) => { return this.toBigNumber(String(b)) }
                this.bytes32ToAscii = (b) => { return this.toAscii(this.toHex(this.toBigNumber(String(b)))) }

		// BladeIron Setup functions
		this.connectRPC = () => 
		{
			try {
				this.client = rpc.client.http({host: this.rpchost, port: this.rpcport});
				return true;
			} catch (err) {
				console.log(err);
				return false;
			}
		}

		this.init = (condType = "Sanity") => 
		{
			const __newAppHelper = (ctrName = this.appName) => (condType = "Sanity") =>
			{
				let output = __getABI(ctrName); let condition = {};
				let _c = this.configs.contracts.filter( (c) => { return (c.ctrName === ctrName && c.conditions.indexOf(condType) !== -1) });
				if (_c.length === 1) {
					condition = { [condType]: path.join(this.configs.conditionDir, this.appName, ctrName, condType + '.js') }; 
				}
	
				return [...output, condition];
			}

			const __getABI = (ctrName = this.appName) =>
			{
				return [this.appName, this.configs.version, ctrName, path.join(this.configs.artifactDir, ctrName + '.json')]
			}

			return this.client.request('connected', [])
      				   .then((rc) => {
      				   	   if (!rc.result) return rc;
      					   return this.client.request('ipfs_connected', []);
      				   })
      				   .then((rc) => {
      				   	   if (!rc.result) return rc;
					   if (this.configs.contracts.length === 0) return Promise.resolve([{}]);

      					   let reqs = this.configs.contracts.map((c) => {
      						   return this.client.request('newApp', __newAppHelper(c.ctrName)(condType));
      					   });
      					
      					   return Promise.all(reqs);
      				   })
		}

		// Ethereum (geth) related functions
                this.call = (ctrName = this.appName) => (callName) => (...args) =>
                {
                        return this.client.request('call', {appName: this.appName, ctrName, callName, args})
                }

                this.sendTk = (ctrName) => (callName) => (...__args) => (amount = null) =>
                {
                        let gasAmount = 250000; // should have dedicated request for gas estimation

                        let tkObj = {};
                        __args.map((i,j) => { tkObj = { ...tkObj, ['arg'+j]: i } });
                        let args = Object.keys(tkObj).sort();

                        return this.client.request('enqueueTk', [this.appName, ctrName, callName, args, amount, gasAmount, tkObj])
                                   .then((rc) => { let jobObj = rc.result; return this.client.request('processJobs', [jobObj]); });
                }

		this.allAccounts = () =>
                {
                        return this.client.request('accounts', [])
                                   .then((rc) => { return rc.result });
                }

		/* 
 		 * IPFS-related calls, wrapped from the low-level jsonrpc calls
 		 * 
 		 * Note: multi-ipfs-keys support will be added soon. 
 		 *
 		 */
		this.ipfsId = () => 
		{
			return this.client.request('ipfs_myid', [])
				   .then((rc) => { return rc.result });
		}

		this.ipfsPut = (filepath) => 
		{
			return this.client.request('ipfs_put', [filepath])
				   .then((rc) => { return rc.result });
		}

		this.ipfsRead = (ipfsHash) =>
		{
			return this.client.request('ipfs_read', [ipfsHash])
				   .then((rc) => { return Buffer(rc.result).toString() });
		}

		this.ipnsPublish = (ipfsHash) =>
		{
			// rpc call 'ipfs_publish' *actually* supports multiple ipfs keys
			// but BladeIron still needs some ipfskey management functions 
			// before exposing it.
			return this.client.request('ipfs_publish', [ipfsHash])
				   .then((rc) => { return rc.result });
		}

		this.pullIPNS = (ipnsHash) =>
		{
			return this.client.request('ipfs_pullIPNS', [ipnsHash])
				   .then((rc) => { return rc.result });
		}
	}
}

module.exports = BladeAPI;
