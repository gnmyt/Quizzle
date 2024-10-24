import CodeWrapper from "@/pages/Home/components/CodeWrapper";
import Button from "@/common/components/Button";
import {faQrcode} from "@fortawesome/free-solid-svg-icons";
import "./styles.sass";


export const CodeInput = ({joinGame, errorClass, scanQr}) => {
    return (
        <>
            <h2>Code eingeben</h2>
            <CodeWrapper onChange={joinGame} errorClass={errorClass}/>

            <div className="alternative">
                <hr/>
                <h2>oder</h2>
                <hr/>
            </div>

            <Button text="Code Scannen" icon={faQrcode} padding={"0.7rem 1.5rem"} onClick={() => scanQr()}/>
        </>
    )
}