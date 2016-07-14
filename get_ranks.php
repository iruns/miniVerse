<?php
require 'connect_to_database.php';
$rows = array();
$result = $conn->query("SELECT * FROM ncbi_taxonomic_rank ORDER BY rank_order");
if ($result != false && $result->num_rows > 0) {
  while($row = $result->fetch_assoc()) {
    array_push($rows,$row);
  }
  echo json_encode($rows);
}
$conn->close();
?>
