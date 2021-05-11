$(document).ready(function () {
	$("#btn-scan").click(e => {
		e.preventDefault();
		Scan();
	});

});

var characteristicCmd;
var characteristicDuties;
var device;

async function Scan() {
	device = await navigator.bluetooth.requestDevice({
        filters: [{
			namePrefix: 'Tuner'
		}],
		optionalServices: ['fe000000-fede-fede-0000-000000000000']});

	let name = device.name;
	let id = device.id;

	device.addEventListener('gattserverdisconnected', onDisconnected);

	await connectDeviceAndCacheCharacteristics();
}

async function GetFreqs() {
	let valueFreq =	new TextDecoder().decode(await characteristicCmd.readValue());
	return valueFreq;
}

async function GetDuties() {
	let valueDuties = new TextDecoder().decode(await characteristicDuties.readValue());
	return valueDuties;
}

async function onDisconnected() {
	console.log("Reconnect");
	await connectDeviceAndCacheCharacteristics();
}

async function connectDeviceAndCacheCharacteristics() {
	if (device.gatt.connected && characteristicCmd) {
		return;
	}
	const server = await device.gatt.connect();
	const service = await server.getPrimaryService('fe000000-fede-fede-0000-000000000000');
	characteristicCmd = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000001'))[0];
	characteristicCmd.addEventListener('characteristicvaluechanged', handleFreqValueChange);
	characteristicDuties = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000002'))[0];
	characteristicDuties.addEventListener('characteristicvaluechanged', handleDutyValueChange);
		
}

function handleFreqValueChange(event) {
  let cmd = new TextDecoder().decode(event.target.value);
  console.log("F: " + cmd);
}

function handleDutyValueChange(event) {
  let cmd = new TextDecoder().decode(event.target.value);
  console.log("D: " + cmd);
}
