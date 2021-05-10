$(document).ready(function () {
	$("#btn-scan").click(e => {
		e.preventDefault();
		Scan();
	});

});

async function Scan() {
	let xxx = navigator.bluetooth.getAdapterState(function(adapter) {console.log("Adapter " + adapter.address + ": " + adapter.name);});
	
	const device = await navigator.bluetooth.requestDevice({
        //filters: [{name: ['Tuner by ThePirat']}]});
		//filters: [{services: ['fe000000-fede-fede-0000-000000000000']}]});
		acceptAllDevices: true, optionalServices: ['battery_service']});
		
	const server = await device.gatt.connect();
	const services = await server.getPrimaryServices();
	const service = await services[0];
	let characteristicCmd = await service.getCharacteristic('ca000000-fede-fede-0000-000000000001');
	let valueFreq = characteristicCmd.readValue();
	
	let characteristicDuties = await service.getCharacteristic('ca000000-fede-fede-0000-000000000002');
	let valueDuties = characteristicCmd.readValue();
}