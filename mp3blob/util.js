const blob = require('@azure/storage-blob');
const BlobServiceClient = blob.BlobServiceClient

let blobServiceClient = null;

module.exports.isEmpty = (val) => {
    return (val === undefined || val === null || val.length <= 0) ? true : false;
}

module.exports.handleFileUploadBlob = async (fileBlob, filename, channelId) => {
 
    try {
        if (blobServiceClient === undefined || blobServiceClient === null) {
            //blobServiceClient = new BlobServiceClient(REACT_APP_AZURE_STORAGE_CONTAINER_CONNECTION);
            blobServiceClient = BlobServiceClient.fromConnectionString(process.env.STRORAGE_CONNECTION_STRING);
        }
        const containerName = channelId;
        let containerClient = blobServiceClient.getContainerClient(containerName);
        const isExits = await containerClient.exists();
        if (!isExits) {
            const createContainerResponse = await containerClient.create();
            console.log(`Create container ${containerName} successfully`, createContainerResponse.requestId);
        }

        containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(filename);
        console.log('\nUploading to Azure storage as blob:\n\t', filename);

        // Upload data to the blob

        const arrayBuffer = await fileBlob.arrayBuffer();
        const uploadBlobResponse = await blockBlobClient.upload(arrayBuffer, fileBlob.size);
        console.log("Blob was uploaded successfully. requestId: ", uploadBlobResponse.requestId);
    } catch (err) {
        console.log(err)
    }
}