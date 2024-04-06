import {Outlet} from "react-router-dom";
import "./styles.sass";
import Background from "@/common/components/Background";

export const Root = () => {
    return (
        <>
            <Background />
            <main>
                <Outlet/>
            </main>
        </>
    );
}