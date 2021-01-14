const mp3lame = require('lamejs');
const Util = require('./util');

const Mp3Encoder = mp3lame.Mp3Encoder
const WavHeader = mp3lame.WavHeader
const handleFileUploadBlob = Util.handleFileUploadBlob;
const isEmpty = Util.isEmpty;
let mp3enc;

module.exports = async function (context, req) {
    context.log('HTTP trigger function processed a request.');

    const wf = req.body.data

    // const name = (req.query.name || (req.body && req.body.name));
    // const responseMessage = name
    //     ? "Hello, " + name + ". This HTTP triggered function executed successfully."
    //     : "This HTTP triggered function executed successfully. Pass a name in the query string or in the request body for a personalized response.";

    // context.res = {
    //     // status: 200, /* Defaults to 200 */
    //     body: responseMessage
    // };

    if (req.method === "POST"){

    }

    const request = JSON.parse(req.body);

    const channelId = request[0].data.channelId;
    const messageId = request[0].data.messageId;
    const wf = request[1].data.wavFragment;

    try {
        const responseMessage = pcmToMp3convertAsync(channelId, messageId, wf)
        context.res = {
            // status: 200, /* Defaults to 200 */
            body: responseMessage
        };
    } catch (error) {
        context.res = {
            body: error
        };
    }
}

async function pcmToMp3convertAsync(channelId, messageId, wf) {
    return await pcmToMp3convert(channelId, messageId, wf)
}

function pcmToMp3convert(channelId, messageId, wf) {
    return new Promise((resolve, reject) => {
        try {
            const wavFragments = wf.wavFragments;
            const wavFragmentCount = wf.wavFragmentCount;

            // Find the length of the audio sent.
            let byteCount = 0;
            for (let i = 0; i < wavFragmentCount; i++) {
                byteCount += wavFragments[i].byteLength;
            }

            // Output array.
            const sentAudio = new Uint8Array(byteCount);

            byteCount = 0;
            for (let i = 0; i < wavFragmentCount; i++) {
                sentAudio.set(new Uint8Array(wavFragments[i]), byteCount);
                byteCount += wavFragments[i].byteLength;
            }

            console.log('wavFragmentCount', wavFragmentCount, 'byteCount', byteCount)

            if (byteCount === 0) {
                console.error('byteCount: 0')
                return
            }
            // create wav file blob
            const view = new DataView(sentAudio.buffer);
            //Wav format specification
            //https://qiita.com/konatsu_p/items/f8f31e3e79c2f429eb55
            //https://qiita.com/tomoyamachi/items/8ff30c3901faa97efb46
            view.setUint32(4, byteCount, true);
            view.setUint32(40, byteCount, true);

            let wav = new Blob([view]);

            // read wave file as base64
            let reader = new FileReader();
            reader.readAsDataURL(wav);
            reader.onload = () => {
                const audioData = reader.result;
                let base64String = audioData.toString();
                base64String = base64String.split(',')[1]; //data:audio/wav;base64,UklGRqy8BAB....

                // Kim: convert base64String to binary buffer
                const binary_string = window.atob(base64String);
                const len = binary_string.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binary_string.charCodeAt(i);
                }

                // Kim: read a header from binary buffer
                // https://stackoverflow.com/questions/64424986/azure-speech-javascript-sdk-output-audio-in-mp3
                let wavHdr = WavHeader.readHeader(
                    new DataView(bytes.buffer)
                );
                console.log('wavHdr', wavHdr)

                let wavSampleRate;
                let wavDataLen;

                //Kim: PCM spec, https://docs.microsoft.com/en-us/azure/cognitive-services/speech-service/how-to-use-audio-input-streams
                //When The binary from continual recording does not have a header, the essential configuration should be set by manual.
                if (wavHdr === undefined) {
                    wavSampleRate = 16000
                    wavDataLen = byteCount
                } else {
                    wavSampleRate = wavHdr.sampleRate;
                    wavDataLen = wavHdr.dataLen;
                }

                const wavSamples = new Int16Array(
                    bytes.buffer,
                    0,
                    wavDataLen / 2
                );

                //Kim: convert wav or pcm to mp3
                let t0 = performance.now()

                wavToMp3async(
                    1, //channel
                    wavSampleRate,
                    wavSamples
                ).then(mp3File => {
                    //Kim: upload mp3 to azure storage
                    const fileId = messageId;
                    const filename = `${fileId}.mp3`
                    if (mp3File.size > 0) {
                        handleFileUploadBlob(mp3File, filename, channelId);
                    }
                }).catch(err => {
                    console.log('mp3 convert', err)
                });

                let t1 = performance.now()
                console.log("performance (mp3) " + (t1 - t0) + " milliseconds.")
            };

            resolve('pcm to mp3 done!');
        } catch (error) {
            reject(error)
        }
    })
}

async function wavToMp3async(channels, sampleRate, binaryData) {
    return await wavToMp3(channels, sampleRate, binaryData)
}

function wavToMp3(channels, sampleRate, binaryData) {
    let buffer = [];

    return new Promise((resolve, reject) => {
        try {
            if (isEmpty(mp3enc))
                mp3enc = new Mp3Encoder(channels, sampleRate, 128);

            let remaining = binaryData.length;
            const maxSamples = 1152;
            for (let i = 0; remaining >= maxSamples; i += maxSamples) {
                let mono = binaryData.subarray(i, i + maxSamples);
                let mp3buf = mp3enc.encodeBuffer(mono);
                if (mp3buf.length > 0) {
                    buffer.push(new Int8Array(mp3buf));
                }
                remaining -= maxSamples;
            }
            const d = mp3enc.flush();
            if (d.length > 0) {
                buffer.push(new Int8Array(d));
            }

            console.log('done encoding, size=', buffer.length);

            const blob = new Blob(buffer, {
                type: 'audio/mp3'
            });
            resolve(blob);
        } catch (error) {
            reject(error)
        }
    })
}