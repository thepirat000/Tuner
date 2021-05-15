$(document).ready(function () {
	GenerateOscillatorsUI();
	$("#btn-scan").click(async function(e) {
		await Scan();
	});
	$("#btn-load").click(async function(e) {
		await Load();
	});
	$("#btn-save").click(async function(e) {
		await Save();
	});
	$("#debug").change(async function(e) {
		let cmd = "debug " + (this.checked ? "1" : "0");
		await SendCommand(cmd);
	});
	
	$('#command').bind('keypress', async function (e) {
		if(e.which == 13) {
			await SendConsoleCommand();
		}
	});
	
	$('.freq-div').on("change", ".slider", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await FreqSliderInput(osc, parseFloat(this.value));
	});
	
	$('.freq-div').on("input", ".slider", function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		SlidingFreq(osc, parseFloat(this.value));
	});

	$('.duty-div').on("change", ".slider", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await DutySliderInput(osc, parseFloat(this.value));
	});	
});

var characteristicCmd;
var characteristicDuties;
var characteristicFreqs;
var device;
const encoder = new TextEncoder('utf-8');

async function Scan() {
	AppendLogLine("Scanning...");
	try {
		device = await navigator.bluetooth.requestDevice({
			filters: [{
				namePrefix: 'Tuner'
			}],
			optionalServices: ['fe000000-fede-fede-0000-000000000000']});
	} catch(err) {
		AppendLogLine("Error: " + err);
		return;
	}
	$("#title").text(device.name);
	AppendLogLine("Connecting to '" + device.name + "'. Please wait...");
	$("body").css("cursor", "progress");
	device.addEventListener('gattserverdisconnected', onDisconnected);
	await connectDeviceAndCacheCharacteristics();
	AppendLogLine("Connected!");
	$("#div-scan").hide();
	$("#btn-reconnect").show();
	$(".top-buttons").show();
	SendCommand("?");
	$("#command-div").show();
	$("body").css("cursor", "default");
}

async function Disconnect() {
	if (device && device.gatt.connected) {
		await device.gatt.disconnect();
	}
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
	try {
		const server = await device.gatt.connect();
		const service = await server.getPrimaryService('fe000000-fede-fede-0000-000000000000');
		characteristicFreqs = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000001'))[0];
		characteristicFreqs.addEventListener('characteristicvaluechanged', handleFreqValueChange);
		await characteristicFreqs.startNotifications();
		characteristicDuties = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000002'))[0];
		characteristicDuties.addEventListener('characteristicvaluechanged', handleDutyValueChange);
		await characteristicDuties.startNotifications();
		characteristicCmd = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000099'))[0];
		characteristicCmd.addEventListener('characteristicvaluechanged', handleCmdValueChange);
		await characteristicCmd.startNotifications();
	}
	catch (err) {
		$("body").css("cursor", "default");
		alert(err);
	}
	$("#oscillators").show();
}

function handleFreqValueChange(event) {
	let freqs = new TextDecoder().decode(event.target.value);
	console.log(freqs);
	let freqsArray = freqs.split(',');
	for (let i = 0; i < freqsArray.length; ++i) {
		ShowFreqValue(i+1, freqsArray[i]);
	}
}

function handleDutyValueChange(event) {
	let duties  = new TextDecoder().decode(event.target.value);
	console.log(duties);
	let dutiesArray = duties.split(',');
	for (let i = 0; i < dutiesArray.length; ++i) {
		ShowDutyValue(i+1, dutiesArray[i]);
	}
}

function handleCmdValueChange(event) {
	let value  = new TextDecoder().decode(event.target.value);
	if (value[value.length-1] == "\n") {
		value = value.replace("\n", "&#13;&#10;");
	}
	AppendLog(value);
}

function AppendLog(value) {
	let cmdOut = $('#command-output');
	cmdOut.append(value); 
	cmdOut.scrollTop(cmdOut[0].scrollHeight - cmdOut.height());
}

function AppendLogLine(value) {
	AppendLog(value + "\n");
}

function GenerateOscillatorsUI() {
	for (let i = 2; i <= 4; ++i) {
		let clone = $("#osc-1").clone();
		clone.attr("id", clone.attr("id").substring(0, clone.attr("id").length - 1) + i);
		clone.find('[id]').each(function () { 
			if (this.id.endsWith("-1")) {
				this.id = this.id.substring(0, this.id.length - 1) + i;
			}
		});
		$(clone).find("#osc-id-" + i).text(i);
		$("#oscillators").append(clone);
	}
}

async function SendConsoleCommand() {
	let cmd = $("#command").val();
	AppendLogLine("> " + cmd);
	await SendCommand(cmd);
	$("#command").val("");
}

function ShowFreqValue(osc, value) {
	let prevValue = $("#slider-freq-" + osc).attr("data-prev-value");
	if (prevValue != value) {
		$("#freq-" + osc).text(parseFloat(value).toFixed(2)).css('color', 'var(--freq-color)');;
		$("#slider-freq-" + osc).val(value);
		$("#slider-freq-" + osc).attr("data-prev-value", value);
		$("#freq-div-" + osc).stop(true,true);
		$("#freq-div-" + osc).effect('highlight',{},500); 
	}
}
// value: 0-1023
function ShowDutyValue(osc, value) {
	let prevValue = $("#slider-duty-" + osc).attr("data-prev-value");
	if (prevValue != value) {
		let percentage = value * 100 / 1023;
		$("#duty-text-" + osc).text(parseFloat(percentage).toFixed(0));
		$("#slider-duty-" + osc).val(percentage);
		$("#slider-duty-" + osc).attr("data-prev-value", value);
		$("#duty-div-" + osc).stop(true,true);
		$("#duty-div-" + osc).effect('highlight',{},500); 
	}
}

async function SendCommand(cmd) {
	if (cmd) {
		let value = encoder.encode(cmd);
		await characteristicCmd.writeValue(value);
	}
}

async function FreqSliderInput(osc, value) {
	let msg = "";
	for(let i = 1; i < osc; ++i) {
		msg += "-1,";
	}
	msg += value;
	await SendCommand(msg);
}

function SlidingFreq(osc, value) {
	// User is sliding the freq slider, show a visual feedback
	$("#freq-" + osc).text(parseFloat(value).toFixed(2)).css('color', 'var(--running-freq-color)');
}

async function DutySliderInput(osc, value) {
	let duty = value * 1023 / 100;
	let msg = "/";
	for(let i = 1; i < osc; ++i) {
		msg += "-1,";
	}
	msg += duty;
	await SendCommand(msg);
}

async function Save() {
	await SendCommand("set");
}
async function Load() {
	await SendCommand("reset");
}