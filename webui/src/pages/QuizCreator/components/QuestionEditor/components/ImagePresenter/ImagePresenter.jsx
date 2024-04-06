import "./styles.sass";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faImage, faUpload} from "@fortawesome/free-solid-svg-icons";
import {useEffect, useState} from "react";

export const ImagePresenter = ({question, onChange}) => {
    const [isDragging, setIsDragging] = useState(false);
    const uploadImage = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                onChange({...question, b64_image: e.target.result});
            }
            reader.readAsDataURL(file);
        }
        input.click();
    }

    const onDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        try {
            const file = e.dataTransfer.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                onChange({...question, b64_image: e.target.result});
            }
            reader.readAsDataURL(file);
        } catch (e) {

        }

    }


    const removeImage = () => {
        onChange({...question, b64_image: undefined});
    }

    useEffect(() => {
        const handlePaste = (e) => {
            if (e.clipboardData.files.length > 0) {
                const file = e.clipboardData.files[0];
                const reader = new FileReader();
                reader.onload = (e) => {
                    onChange({...question, b64_image: e.target.result});
                }
                reader.readAsDataURL(file);
            }
        }

        document.addEventListener("paste", handlePaste);

        return () => {
            document.removeEventListener("paste", handlePaste);
        }
    }, [question]);

    return (
        <div className="image-presenter-edit">
            <div className="image-container" onClick={question.b64_image ? removeImage : uploadImage} onDrop={onDrop}
                 onDragOver={(e) => {e.preventDefault();
                     setIsDragging(true);}}
                 onDragLeave={() => setIsDragging(false)}>
                {question.b64_image && <img src={question.b64_image} alt="question"/>}
                {!question.b64_image && <FontAwesomeIcon icon={isDragging ? faUpload : faImage}/>}
            </div>
        </div>
    )
}