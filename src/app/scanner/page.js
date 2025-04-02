"use client";

import { useState, useRef, useEffect } from 'react';

export default function Scanner() {
    const [isScanning, setIsScanning] = useState(false);
    const [scannedData, setScannedData] = useState(null);
    const [isMounted, setIsMounted] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState('');
    const [prediction, setPrediction] = useState(null);
    const [nutrition, setNutrition] = useState(null);
    const [loading, setLoading] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    useEffect(() => {
        let isMounted = true;
        let stream = null;

        const getDevices = async () => {
            try {

                stream = await navigator.mediaDevices.getUserMedia({ video: true });

                stream.getTracks().forEach(track => track.stop());

                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === 'videoinput');

                if (!isMounted) return;

                setDevices(videoDevices);

                if (videoDevices.length > 0) {

                    const rearCamera = videoDevices.find(device =>
                        device.label.toLowerCase().includes('back') ||
                        device.label.toLowerCase().includes('rear')
                    );

                    setSelectedDevice(rearCamera?.deviceId || videoDevices[0].deviceId);
                }
            } catch (err) {
                if (!isMounted) return;

                console.error('Device enumeration error:', err);
                if (err.name === 'NotAllowedError') {
                    console.warn('Camera permission denied');
                } else if (err.name === 'NotFoundError') {
                    console.warn('No cameras found');
                }
            }
        };

        getDevices();

        return () => {
            isMounted = false;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const startCamera = async () => {
        try {
            // if (!isMounted || !videoRef.current) {
            //     throw new Error("Video element not ready");
            // }
            setScannedData(null);
            setCameraError(null);

            const constraints = {
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'environment',
                    deviceId: selectedDevice ? { exact: selectedDevice } : undefined
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsScanning(true);
            }
        } catch (err) {
            console.error('Camera error:', err);
            setCameraError(err.message);
            setIsScanning(false);
        }
    };

    const analyzeWithGemini = async (imageData) => {
        setLoading(true);
        setCameraError(null);
        
        try {
            const base64Data = imageData.split(',')[1];
            if (!base64Data) throw new Error("Invalid image data");

            // Call your Next.js API endpoint for Gemini
            const response = await fetch('/api/analyze-food', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64Data })
            });
            console.log(response);
            const result = await response.json();
    
            if (!response.ok || !result.success) {
              throw new Error(result.error || "Analysis failed");
            }
            
            if (!result.success) {
                throw new Error(result.error || "Analysis failed");
            }

            // Gemini returns both identification and nutrition
            setPrediction({
                name: result.foodName,
                confidence: result.confidence
            });

            setNutrition({
                calories: result.calories,
                protein: result.protein,
                carbs: result.carbs,
                fats: result.fats
            });

        } catch (err) {
            setCameraError(`Analysis failed: ${err.message}`);
            console.error("Gemini API error:", err);
        } finally {
            setLoading(false);
        }
    };


    // const analyzeWithImagga = async (imageData) => {
    //     setLoading(true);
    //     setCameraError(null);
    //     try {
    //         if (!imageData || !imageData.startsWith('data:image')) {
    //             throw new Error("Invalid image data");
    //         }
    //         const base64Data = imageData.startsWith('data:image')
    //             ? imageData.split(',')[1]
    //             : imageData;

    //         if (!base64Data) {
    //             throw new Error("Invalid image data");
    //         }
    //         console.log(base64Data);

    //         const response = await fetch('/api/analyze-food', {
    //             method: 'POST',
    //             headers: { 'Content-Type': 'application/json' },
    //             body: JSON.stringify({
    //                 imageBase64: base64Data
    //             })
    //         });
    //         if (!response.ok) {
    //             const errorData = await response.json().catch(() => ({}));
    //             throw new Error(errorData.error || `API request failed: ${response.status}`);
    //         }

    //         const result = await response.json();

    //         if (!result.success) throw new Error(result.error);

    //         // Process results
    //         const topFood = result.tags[0]; // Get highest confidence tag
    //         setPrediction({
    //             name: topFood.tag.en,
    //             confidence: topFood.confidence
    //         });

    //         // Then fetch nutrition data
    //         const nutrition = await getNutrition(topFood.tag.en);
    //         setNutrition(nutrition);

    //     } catch (err) {
    //         setCameraError(`Food recognition failed: ${err.message}`);
    //         console.error("Analysis error:", err);
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    // async function getNutrition(foodName) {
    //     try {
    //         const response = await fetch(
    //             `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(foodName)}&search_simple=1&action=process&json=1&fields=product_name,nutriments`
    //         );
    //         const data = await response.json();

    //         if (data.products.length > 0) {
    //             return {
    //                 name: data.products[0].product_name,
    //                 calories: data.products[0].nutriments['energy-kcal_100g'],
    //                 protein: data.products[0].nutriments['proteins_100g'],
    //                 carbs: data.products[0].nutriments['carbohydrates_100g'],
    //                 fats: data.products[0].nutriments['fat_100g']
    //             };
    //         }
    //     } catch (err) {
    //         console.error("Nutrition API error:", err);
    //         return null;
    //     }
    // }

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setIsScanning(false);
        }
    };

    const captureImage = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');


        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;


        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setScannedData(imageData);
        analyzeWithGemini(imageData);

        // analyzeWithImagga(imageData);
    };


    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <header className="bg-blue-200 text-white p-4 shadow-md h-20">
                <h1 className="text-blue-500 text-2xl font-bold text-left">CalScan</h1>
            </header>

            <main className="flex-grow container mx-auto p-4 py-9 flex flex-col items-center">
                {/* Camera selection dropdown */}
                {devices.length > 1 && (
                    <div className="w-full max-w-md mb-4">
                        <label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 mb-1">
                            Select Camera:
                        </label>
                        <select
                            id="camera-select"
                            value={selectedDevice}
                            onChange={(e) => setSelectedDevice(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                            disabled={isScanning}
                        >
                            {devices.map((device) => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `Camera ${device.deviceId.substring(0, 5)}`}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Camera preview */}
                <div className="relative w-full max-w-2xl aspect-video bg-black rounded-lg overflow-hidden shadow-lg mb-4">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${!isScanning ? 'hidden' : ''}`}
                    />
                    {!isScanning && (
                        <div className="absolute inset-0 flex items-center justify-center text-white">
                            <p>Camera is off</p>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex flex-wrap justify-center gap-4 mb-6">
                    {!isScanning ? (
                        <button
                            onClick={startCamera}
                            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-md"
                        >
                            Start Camera
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={captureImage}
                                disabled={loading}
                                className={`px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md ${loading ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                            >
                                {loading ? 'Analyzing...' : 'Capture Food'}
                            </button>
                            <button
                                onClick={stopCamera}
                                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-md"
                            >
                                Stop Camera
                            </button>
                        </>
                    )}
                </div>

                {/* Error message */}
                {cameraError && (
                    <div className="w-full max-w-md p-4 mb-6 bg-red-100 border border-red-400 text-red-700 rounded-md">
                        <p>{cameraError}</p>
                    </div>
                )}

                {/* Results display */}
                {scannedData && (
                    <div className="w-full max-w-2xl p-6 bg-white rounded-lg shadow-md border border-gray-200">
                        <h2 className="text-xl font-semibold mb-4 text-gray-800">Food Analysis</h2>

                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="w-full md:w-1/2">
                                <img
                                    src={scannedData}
                                    alt="Captured Food"
                                    className="w-full rounded-md border border-gray-300"
                                />
                            </div>

                            <div className="w-full md:w-1/2">
                                {prediction && (
                                    <div className="mb-6">
                                        <h3 className="text-black font-semibold mb-2">Identified Food</h3>
                                        <div className="p-3 bg-gray-50 rounded-lg">
                                            <p className="text-gray-500 font-semibold font-medium">{prediction.name}</p>
                                            {/* <p className="text-sm text-gray-600">
                                                Confidence: {(prediction.confidence * 100).toFixed(1)}%
                                            </p> */}
                                        </div>
                                    </div>
                                )}

                                {nutrition && (
                                    <div>
                                        <h3 className="text-black font-semibold mb-2">Nutritional Information</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-blue-50 p-3 rounded-lg">
                                                <p className="text-sm text-gray-600">Calories</p>
                                                <p className="text-gray-500 font-bold">{nutrition.calories} kcal</p>
                                            </div>
                                            <div className="bg-green-50 p-3 rounded-lg">
                                                <p className="text-sm text-gray-600">Protein</p>
                                                <p className="text-gray-500 font-bold">{nutrition.protein}g</p>
                                            </div>
                                            <div className="bg-yellow-50 p-3 rounded-lg">
                                                <p className="text-sm text-gray-600">Carbs</p>
                                                <p className="text-gray-500 font-bold">{nutrition.carbs}g</p>
                                            </div>
                                            <div className="bg-red-50 p-3 rounded-lg">
                                                <p className="text-sm text-gray-600">Fats</p>
                                                <p className="text-gray-500 font-bold">{nutrition.fats}g</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <canvas ref={canvasRef} className="hidden" />
            </main>

            <footer className="bg-gray-800 text-white p-4 text-center text-sm">
                <p>Point your camera at your food to scan</p>
            </footer>
        </div>
    );
}