$(document).ready(function () {
	$("#btn-scan").click(e => {
		e.preventDefault();
		Scan();
	});

});

var characteristicCmd;
var characteristicDuties;

async function Scan() {
	const device = await navigator.bluetooth.requestDevice({
        filters: [{
			namePrefix: 'Tuner'
		}],
		optionalServices: ['fe000000-fede-fede-0000-000000000000']});

	let name = device.name;
	let id = device.id;

	const server = await device.gatt.connect();
	const service = await server.getPrimaryService('fe000000-fede-fede-0000-000000000000');
	characteristicCmd = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000001'))[0];
	characteristicDuties = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000002'))[0];
	alert("D: " + GetDuties() + '\nF: ' + GetFreqs());
	alert("D: " + GetDuties() + '\nF: ' + GetFreqs());
}

async function GetFreqs() {
	let valueFreq =	new TextDecoder().decode(await characteristicCmd.readValue());
	return valueFreq;
}

async function GetDuties() {
	let valueDuties = new TextDecoder().decode(await characteristicDuties.readValue());
	return valueDuties;
}