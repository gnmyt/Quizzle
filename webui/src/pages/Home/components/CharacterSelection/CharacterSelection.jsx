import "./styles.sass";
import Button from "@/common/components/Button";
import Input from "@/common/components/Input";
import {useState} from "react";

export const CharacterSelection = ({submit}) => {
    const [name, setName] = useState("");

    const submitName = () => {
        if (name.length < 3) {
            alert("Name muss mindestens 3 Zeichen lang sein");
            return;
        }

        submit(name);
    }

    return (
        <div className="character-selection">
            <div className="character-icon">
                <img src="https://via.placeholder.com/150" alt="Character"/>
            </div>
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}/>
            <Button text="Beitreten" padding={"0.7rem 1.5rem"} onClick={submitName}/>
        </div>
    )
}