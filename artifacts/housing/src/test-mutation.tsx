import { useDeleteBuilding } from "@workspace/api-client-react";

function TestComponent() {
  const deleteBuildingMut = useDeleteBuilding();
  
  const test1 = () => deleteBuildingMut.mutateAsync({ id: 123 });
  const test2 = () => {}
}
