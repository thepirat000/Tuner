let characteristicCmd;
let characteristicDuties;
let characteristicFreqs;
let device;
const encoder = new TextEncoder('utf-8');
let lastFreqFromMic = 0.0;

$(document).ready(function () {
	
	$('.lcs_check').lc_switch();
	
	GenerateOscillatorsUI();
	
	StartMidi();
	
	$("#btn-scan").click(async function(e) {
		await Scan();
	});
	$("#btn-test").click(async function(e) {
		ShowOscillators();
	});
	$("#btn-load").click(async function(e) {
		await Load();
	});
	$("#btn-save").click(async function(e) {
		await Save();
	});
	$("#btn-clear").click(function(e) {
		Clear();
	});
	$("#debug").change(async function(e) {
		let cmd = "debug " + (this.checked ? "1" : "0");
		await SendCommand(cmd);
	});
	$("input[name=preset]").dblclick(async function(e) {
		await Load();
	});
	$('#command').bind('keypress', async function (e) {
		if(e.which == 13) {
			await SendConsoleCommand();
		}
	});
	
	$('.freq-div').on("change", ".slider", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await FreqInput(osc, parseFloat(this.value));
	});
	$('.freq-div').on("input", ".slider", function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		SlidingFreq(osc, parseFloat(this.value));
	});

	$('.duty-div').on("change", ".slider", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await DutyInput(osc, parseFloat(this.value));
	});	
	$('.duty-div').on("input", ".slider", function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		SlidingDuty(osc, parseFloat(this.value));
	});
	
	$('.freq-div').on("click", ".freq,.note", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await ChangeFreqManual(osc, $(this).text());
	});	
	
	$('.duty-div').on("click", ".duty", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await ChangeDutyManual(osc, $(this).text());
	});

	$('.freq-div').on("click", ".step-button", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await HandleFreqStepButton(osc, $(this).attr('data-op'));
	});	
	
	$('.oscillator').on("lcs-statuschange", ".lcs_check", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		let status = ($(this).is(':checked')) ? 'on' : 'off';
		await HandleTurnOffOn(osc, status);
	});	

	$('.set-duty-buttons').on("click", ".step-button", async function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		await DutyInput(osc, parseFloat(this.attributes["data-value"].value));
	});
	
	$('.id-div').on("change", "input[name=mic]", function(e) {
		let osc = parseInt(this.id[this.id.length - 1]);
		HandleMicCheck(osc, this.checked);
	});	
});

async function Scan() {
	$("#console").show();
	AppendLogLine("Scanning...");
	try {
		device = await navigator.bluetooth.requestDevice({
			filters: [{
				namePrefix: 'Tuner'
			}],
			optionalServices: ['fe000000-fede-fede-0000-000000000000']});
	} catch(err) {
		AppendLogLine("Error: " + err);
		HideOscillators();
		return;
	}
	$("#title").text(device.name);
	AppendLogLine("Connecting to '" + device.name + "'. Please wait...");
	ShowWaitCursor();
	device.addEventListener('gattserverdisconnected', onDisconnected);
	await connectDeviceAndCacheCharacteristics();
	SendCommand("?");
	ShowOscillators();
	HideWaitCursor();
}

function ShowOscillators() {
	$("#div-scan").hide();
	$("#btn-reconnect").show();
	$(".top-buttons").show();
	$("#command-div").show();
	$("#oscillators").show();
}

function HideOscillators() {
	$("#div-scan").show();
	$("#btn-reconnect").hide();
	$(".top-buttons").hide();
	$("#command-div").hide();
	$("#oscillators").hide();
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
	ShowWaitCursor();
	AppendLogLine("Disconnected");
	await connectDeviceAndCacheCharacteristics();
	HideWaitCursor();
	SendCommand("?");
}

async function connectDeviceAndCacheCharacteristics() {
	if (device.gatt.connected && characteristicCmd) {
		return;
	}
	try {
		AppendLogLine("Connecting");
		const server = await device.gatt.connect();
		const service = await server.getPrimaryService('fe000000-fede-fede-0000-000000000000');
		characteristicFreqs = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000001'))[0];
		characteristicFreqs.addEventListener('characteristicvaluechanged', handleFreqValueChange);
		await characteristicFreqs.startNotifications();
		characteristicDuties = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000002'))[0];
		characteristicDuties.addEventListener('characteristicvaluechanged', handleDutyValueChange);
		await characteristicDuties.startNotifications();
		characteristicSwitches = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000003'))[0];
		characteristicSwitches.addEventListener('characteristicvaluechanged', handleSwitchesValueChange);
		await characteristicSwitches.startNotifications();
		characteristicCmd = (await service.getCharacteristics('ca000000-fede-fede-0000-000000000099'))[0];
		characteristicCmd.addEventListener('characteristicvaluechanged', handleCmdValueChange);
		await characteristicCmd.startNotifications();
		AppendLogLine("Connected");
	}
	catch (err) {
		HideWaitCursor();
		HideOscillators();
		alert(err);
	}
}

function handleFreqValueChange(event) {
	for (let i = 0; i*2 < event.target.value.byteLength; ++i) {
		let value = event.target.value.getUint16(i*2);
		ShowFreqValue(i+1, value);
	}
}

function handleDutyValueChange(event) {
	for (let i = 0; i*2 < event.target.value.byteLength; ++i) {
		let value = event.target.value.getUint16(i*2);
		ShowDutyValue(i+1, value);
	}
}

function handleSwitchesValueChange(event) {
	for (let i = 0; i < event.target.value.byteLength; ++i) {
		let value = event.target.value.getUint8(i);
		ShowSwitchValue(i+1, value);
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

function Clear() {
	$("#command-output").empty();
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
		clone.find('[for]').each(function () { 
			if (this.htmlFor.endsWith("-1")) {
				this.htmlFor = this.htmlFor.substring(0, this.htmlFor.length - 1) + i;
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
	$("#freq-" + osc).css('color', 'var(--freq-color)');
	if (prevValue != value) {
		let freq = parseInt(value);
		$("#freq-" + osc).text(freq);
		$("#freq-note-" + osc).text(GetNote(freq));
		$("#slider-freq-" + osc).val(value);
		$("#slider-freq-" + osc).attr("data-prev-value", value);
		$("#freq-div-" + osc).stop(true,true);
		$("#freq-div-" + osc).effect('highlight',{},500); 
	}
}
// value: 0-1023
function ShowDutyValue(osc, value) {
	let prevValue = $("#slider-duty-" + osc).attr("data-prev-value");
	$("#duty-text-" + osc).css('color', 'var(--duty-color)');
	if (prevValue != value) {
		let percentage = value * 100 / 1023;
		$("#duty-text-" + osc).text(parseFloat(percentage).toFixed(0));
		$("#slider-duty-" + osc).val(percentage);
		$("#slider-duty-" + osc).attr("data-prev-value", value);
		$("#duty-div-" + osc).stop(true,true);
		$("#duty-div-" + osc).effect('highlight',{},500); 
	}
}

function ShowSwitchValue(osc, value) {
	// Change the switch values without triggering the onchange
	let oscSwitch = $("#osc-" + osc + " .lcs_wrap .lcs_switch")
	if (value) {
		oscSwitch.removeClass('lcs_off').addClass('lcs_on');
	} 
	else {
		oscSwitch.removeClass('lcs_on').addClass('lcs_off');
	}
}

async function SendCommand(cmd) {
	if (cmd) {
		let value = encoder.encode(cmd);
		try {
			await characteristicCmd.writeValue(value);
		} catch {}
	}
}

function SlidingFreq(osc, value) {
	// User is sliding the freq slider, show a visual feedback
	let freq = parseInt(value);
	$("#freq-" + osc).text(freq).css('color', 'var(--running-freq-color)');
	$("#freq-note-" + osc).text(GetNote(freq));
}

function GetNote(freq) {
	if (freq > 0) {
		let note = new Note();
		note.setFrequency(freq);
		if (note.name) {
			let notes = note.name.split('/');
			if (notes.length > 1) {
				if (notes[1][0] == 'E' || notes[1][0] == 'B') {
					// Use bemol
					return notes[1];
				}
				return notes[0];
			}
			return notes[0];
		}
	}
	return "N/A";
}

function SlidingDuty(osc, value) {
	// User is sliding the duty slider, show a visual feedback
	$("#duty-text-" + osc).text(parseInt(value)).css('color', 'var(--running-duty-color)');
}

async function FreqInput(osc, value) {
	// User finished sliding freq slider
	if (value < 0) {
		value = 0;
	}
	if (value > 40000) {
		value = 40000;
	}
	let msg = "";
	for(let i = 1; i < osc; ++i) {
		msg += ",";
	}
	msg += value;
	await SendCommand(msg);
}

async function DutyInput(osc, value) {
	// User finished sliding duty slider
	let duty = value >= 100 ? 1023 : parseInt(value * 1024 / 100);
	let msg = "/";
	for(let i = 1; i < osc; ++i) {
		msg += ",";
	}
	msg += duty;
	await SendCommand(msg);
}

async function Save() {
	let pindex = $("input[name='preset']:checked").val() - 1;
	await SendCommand("save " + pindex);
	$("#btn-save").stop(true,true);
	$("#btn-save").effect('highlight',{},500); 
	AppendLogLine("Saved");
}
async function Load() {
	let pindex = $("input[name='preset']:checked").val() - 1;
	await SendCommand("load " + pindex);
	$("#btn-load").stop(true,true);
	$("#btn-load").effect('highlight',{},500); 
	AppendLogLine("Loaded");
}

function ShowWaitCursor() {
	document.documentElement.style.cursor = 'wait';
	$("input").css("cursor", "progress");
}
function HideWaitCursor() {
	document.documentElement.style.cursor = 'default';
	$("input").css("cursor", "default");
}

async function ChangeFreqManual(osc, currValue) {
	let input = prompt("Enter the new frequency (in Hertz or note name) for OSC " + osc, currValue);
	if (input) {
		let freq = parseInt(input);
		if (!isNaN(freq)) {
			// Freq is a number in hertz
			if (freq >= 0) {
				await FreqInput(osc, freq);
			}
		} else {
			// Freq is not a number, assuming it is a note
			let note = new Note();
			note.setName(input);
			await FreqInput(osc, parseInt(note.frequency));
		}
	}
}

async function ChangeDutyManual(osc, currValue) {
	let input = prompt("Enter the new duty cycle (0-100) for OSC " + osc, currValue);
	if (input) {
		let duty = parseInt(input);
		if (duty >= 0) {
			await DutyInput(osc, duty);
		}
	}
}

async function HandleFreqStepButton(osc, op) {
	let operand = parseFloat((op == '+' || op == '-') ? $("#incr-freq-step-" + osc).val() : $("#mult-freq-step-" + osc).val());
	if (operand > 0) {
		operand = op == '-' ? (operand * -1) : op == '/' ? (1 / operand) : operand;
		let msg = (op == '+' || op == '-') ? "+" : "*";
		for(let i = 1; i < osc; ++i) {
			msg += ",";
		}
		msg += operand;
		await SendCommand(msg);
	}
}

async function HandleTurnOffOn(osc, status) {
	await SendCommand(status + " " + osc);
}

function StartMidi() {
	if (!navigator.requestMIDIAccess) {
		return;
	}
	navigator.requestMIDIAccess()
		.then(midi => {
			for (var input of midi.inputs.values()) {
				input.onmidimessage = onMIDIMessage;
			}
		});
}

async function onMIDIMessage(message) {
	let checked = $("input[name=midi]:checked");
	if (checked.length == 0) {
		return;
	}
	
    var command = message.data[0];
    var note = message.data[1];
    var velocity = (message.data.length > 2) ? message.data[2] : 0; // a velocity value might not be included with a noteOff command

	for(let input of checked) {
		let osc = input.id.substring(input.id.length - 1);
		switch (command) {
			case 144: 
				if (velocity > 0) {
					await noteOn(note, velocity, osc, true);
				} else {
					await noteOff(note, osc, true);
				}
				break;
			case 128: 
				await noteOff(note, osc, true);
				break;
		}
	}		
}


async function noteOn(note, velocity, osc, sustain) {
	let duty = velocityToDuty(velocity);
	if (duty > 0) {
		let freq = noteToFreq(note);
		SlidingFreq(osc, freq);
		SlidingDuty(osc, duty);
		await FreqInput(osc, freq);
		await sleep(10);
		await DutyInput(osc, duty);
	}
	if (!sustain) {
		await DutyInput(osc, duty);
	}
}

async function noteOff(note, osc, sustain) {
	if (!sustain) {
		SlidingDuty(osc, 0);
		await DutyInput(osc, 0);
	}
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function noteToFreq(note) {
    let a = 440;
    return (a / 32) * (2 ** ((note - 9) / 12));
}

function velocityToDuty(velocity) {
	// 0 -> 0%
	// 1-127 => 15%-85% (255-767)
	if (velocity <= 0) {
		return 0;
	}
	return ((velocity*70/127)+15).toFixed(0);
}

function HandleMicCheck(osc, checked) {
	if (PitchDetect.AudioContext == null && checked) {
		// Turn on Mic
		PitchDetect.MinTimeBetweenUpdates = 250;
		PitchDetect.Init();
		PitchDetect.StartLiveInput(async (current, lastKnown) => await callbackPitchDetect(current, lastKnown));
	}
	else if (PitchDetect.AudioContext != null && $("input[name=mic]:checked").length == 0) {
		// Turn off Mic
		PitchDetect.StopLiveInput();
		PitchDetect.AudioContext = null;
	}
}

async function callbackPitchDetect(current, lastKnown) {
	let freq = Math.round(lastKnown);
	if (freq > 0 && lastFreqFromMic != freq) {
		lastFreqFromMic = freq;
		for(let micCheck of $("input[name=mic]:checked")) {
			let osc = parseInt(micCheck.id[micCheck.id.length - 1]);
			SlidingFreq(osc, freq);
			FreqInput(osc, freq);
		}
	}
}
