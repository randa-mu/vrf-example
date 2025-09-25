"use client"
import Image from "next/image";
import Link from "next/link"

const Header = () => {

    return (
        <div className="w-full h-20 flex items-center bg-transparent">
            <div className="relative lg:left-8 left-4">
                <Link href="/">
                    <Image
                        className="cursor-pointer hidden lg:block"
                        src="/assets/logos/lightLogo.svg"
                        width={150}
                        height={150}
                        alt="Randamu Logo"
                    />
                    <div
                        className="lg:hidden justify-center items-center flex"
                    >
                        <Image
                            className="cursor-pointer "
                            src="/assets/logos/lightLogo.svg"
                            width={150}
                            height={150}
                            alt="Randamu Logo"
                        />
                    </div>
                </Link>
            </div>
        </div >
    );
};

export default Header;
