import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faImage, faUpload} from "@fortawesome/free-solid-svg-icons";
import {useEffect, useState} from "react";
import {createFileInput} from "@/common/utils/FileOperationsUtil.js";
import {imageCache} from "@/common/utils/ImageCacheUtil.js";

export const ImagePresenter = ({question, onChange}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [imageDataUrl, setImageDataUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const loadImage = async () => {
            if (question.imageId) {
                setIsLoading(true);
                try {
                    const dataUrl = await imageCache.getImage(question.imageId);
                    setImageDataUrl(dataUrl);
                } catch (error) {
                    console.error("Error loading image from cache:", error);
                    onChange({...question, imageId: undefined});
                } finally {
                    setIsLoading(false);
                }
            } else {
                setImageDataUrl(null);
                setIsLoading(false);
            }
        };

        loadImage();
    }, [question.imageId, question.uuid]);

    const storeImageFile = async (file) => {
        if (!file || !file.type.startsWith('image/')) {
            console.error("Invalid file type");
            return;
        }

        setIsLoading(true);
        try {
            if (question.imageId) {
                await imageCache.deleteImage(question.imageId);
            }

            const imageId = await imageCache.storeImage(question.uuid, file);
            onChange({...question, imageId: imageId});
        } catch (error) {
            console.error("Error storing image:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const uploadImage = () => {
        createFileInput("image/*", (file) => {
            storeImageFile(file);
        });
    }

    const onDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            storeImageFile(file);
        }
    }
    const removeImage = async () => {
        if (question.imageId) {
            try {
                await imageCache.deleteImage(question.imageId);
            } catch (error) {
                console.error("Error deleting image from cache:", error);
            }
        }
        onChange({...question, imageId: undefined});
        setImageDataUrl(null);
    }

    useEffect(() => {
        const handlePaste = (e) => {
            if (e.clipboardData.files.length > 0) {
                const file = e.clipboardData.files[0];
                if (file.type.startsWith('image/')) {
                    storeImageFile(file);
                }
            }
        }

        document.addEventListener("paste", handlePaste);

        return () => {
            document.removeEventListener("paste", handlePaste);
        }
    }, [question, onChange]);

    const hasImage = imageDataUrl;

    return (
        <div className="image-presenter-edit">
            <div 
                className="image-container" 
                onClick={hasImage ? removeImage : uploadImage} 
                onDrop={onDrop}
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                style={{ opacity: isLoading ? 0.7 : 1 }}
            >
                {hasImage && !isLoading && (
                    <img src={imageDataUrl} alt="question"/>
                )}
                {!hasImage && !isLoading && (
                    <FontAwesomeIcon icon={isDragging ? faUpload : faImage}/>
                )}
            </div>
        </div>
    )
}