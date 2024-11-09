import React, { useState } from "react";
import { DdcClient,MAINNET, File as DdcFile, JsonSigner } from '@cere-ddc-sdk/ddc-client';
import signerJson from '../6RntjtMjxuGDV2VXU14rZ5RdTA1rb92babTRzjC35YiVKy1e.json';
import { Toaster, toast } from "react-hot-toast";


const cere_get_url = "https://cdn.dragon.cere.network";
const acurast_url = "https://heic2png.processor-proxy.sook.ch";
// const acurast_url = "http://127.0.0.1:3000";
const password = import.meta.env.VITE_KEY as string;
// @ts-expect-error This is necessary because the JsonSigner constructor expects a KeyringPair$Json, but we're passing a custom object.
const signer = new JsonSigner(signerJson, {passphrase: password});
const ddcClient = new DdcClient(signer, MAINNET);
const bucketId: bigint = 1032n;

const FileUploader = () => {

  const [file, setFile] = useState<File | null>(null);
  const [uploadCid, setUploadCid] = useState<string | null>(null);
  const [downloadCid, setDownloadCid] = useState<string | null>(null);
  const [converting, setConverting] = useState<boolean>(false);
  // const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [convertedFileUrl, setConvertedFileUrl] = useState<string | null>(null);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile((selectedFile as File));
    }
  };

  const uploadFile = async () => {
    if (!file) {
      console.error("No file selected for upload.");
      return;
    }
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    const ddcfile = new DdcFile(fileData, {size: fileData.length});
    const { cid: fileCid } = await ddcClient.store(bucketId, ddcfile);
    setUploadCid(fileCid);
    toast.success('File uploaded to cere successfully');
    console.log('The uploaded file CID', fileCid)
  }

  const downloadFromAcurast = async () => {
    console.log('Download url: ', `${acurast_url}${convertedFileUrl}`);
    try {
      const response = await fetch(`${acurast_url}${convertedFileUrl}`, {
        method: 'GET',
        headers: {
          'Accept': 'image/png, application/json'
        }
      });

      if (!response.ok) {
        console.error(`Failed to retrieve the file. Status: ${response.status}`);
        return null;
      }

      // Verify the Content-Type is 'image/png'
      const contentType = response.headers.get('Content-Type');
      console.log('Content-Type:', contentType);

      // Convert the response to a Blob
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      const ddcfile = new DdcFile(fileData, {size: fileData.length});
      const { cid: fileCid } = await ddcClient.store(bucketId, ddcfile);
      setDownloadCid(fileCid);
      return blob;

    } catch (error) {
      console.error("An error occurred while fetching the PNG file:", error);
      return null;
    }
  }

  const convertFile = async () => {
    if (!file) {
      console.error("No file selected for conversion.");
      return;
    }
    setConverting(true);

    try {
      // Create a FormData object and append the file
      const formData = new FormData();
      formData.append("image", file);
      toast.loading('Converting file...', {duration: 10000});

      const response = await fetch(`${acurast_url}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        console.error(`File upload failed with status: ${response.status}`);
        return;
      }

      const result = await response.json();
      console.log(result);

      await checkStatus(result.id)
      await downloadFromAcurast();

      setConverting(false);
      return result;
    } catch (error) {
      setConverting(false);
      console.error("An error occurred during file upload and conversion:", error);
    }
  };

 async function checkStatus(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 12; // 3 minutes maximum with 10-second intervals
      
      const pollingInterval = setInterval(async () => {
        try {
          console.log(`Polling attempt ${attempts + 1}...`);
          
          const response = await fetch(`${acurast_url}/processed/${id}`,
            
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'accept': 'application/json',
              'Cache-Control': 'no-cache',
            }
          }
          );
          const result = await response.json();
          
          if (!response.ok) {
            console.error(`Server error: ${response.status}`);
            clearInterval(pollingInterval);
            reject(new Error(`Server returned ${response.status}`));
            return;
          }

          if (result.success && result.url) {
            console.log('Processing completed:', result.url);
            setConvertedFileUrl(result.url);
            toast.success('File converted successfully');
            clearInterval(pollingInterval);
            resolve();
            return;
          }

          // Increment attempts and check if we've exceeded maximum
          attempts++;
          if (attempts >= maxAttempts) {
            clearInterval(pollingInterval);
            reject(new Error('Processing timeout'));
          }
        } catch (error) {
          console.error('Polling error:', error);
          clearInterval(pollingInterval);
          reject(error);
        }
      }, 10000); // Poll every 10 seconds

      // Clean up interval if promise is rejected externally
      return () => clearInterval(pollingInterval);
    });
  }

  const handleUpload = async () => {
    if (file) {
      await uploadFile();
    }
  };

  const handleConvert = async () => {
    if (uploadCid) {
      await convertFile();
    }
  };

  return (
    <div className="flex flex-col w-full justify-center items-center mt-40">
      <Toaster />
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-blue-400 mb-4">HEIC to PNG Converter</h1>
      </div>

      <div className="bg-gray-100 rounded-lg shadow-lg mx-auto p-6">
        <label className="block mb-2 text-sm font-medium text-gray-700">Select a HEIC file:</label>
        <input
          type="file"
          accept=".heic"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-700 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
        />

        <button
          onClick={handleUpload}
          disabled={!file}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg"
        >
          Upload File
        </button>

        {uploadCid && (
          <button
            onClick={handleConvert}
            className={`mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg ${converting ? 'cursor-not-allowed animate-pulse' : ''}`}
          >
            Convert to PNG
          </button>
        )}

        {downloadCid && (
          <div
          className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold p-2 rounded-lg text-center"
          >

            <a
              href="#"
              onClick={async (e) => {
                e.preventDefault();

                const response = await fetch(`${cere_get_url}/${bucketId}/${downloadCid}`);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);

                // Create a temporary link element
                const link = document.createElement("a");
                link.href = url;
                link.download = "converted.png";

                // Append the link, click it, and then remove it
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Release the object URL to free memory
                window.URL.revokeObjectURL(url);
              }}
            >
              Download PNG From Cere
            </a>

          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploader;