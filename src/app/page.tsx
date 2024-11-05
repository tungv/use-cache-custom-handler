import { Suspense } from "react";
import Random from "./Random";

export default function Home() {
  return (
    <main>
      <div>Hello world!</div>
      <Suspense fallback={<div>Loading...</div>}>
        <Random />
      </Suspense>
    </main>
  );
}
