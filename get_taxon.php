<?php
require 'connect_to_database.php';

$search_term = $_GET["search_term"];

// try to find an exact match
$result = getBy($search_term,
                // from table
                "ncbi_biological_classification",
                // get fields
                array("_id", "_label", "_alternative_labels",
                  "rank", "_superclasses", "_subclasses",
                  "image_wikimedia"
                ),
                // from strict fields
                array("_label", "_id")
                // from similar fields
              );
// if found get the family tree
if ($result != NULL) {
  $taxa = array();

  if($result["_subclasses"]!=NULL)
    $result["_subclasses"] = explode("|", $result["_subclasses"]);

  $subclasses = getByIds($result["_subclasses"],
                    // from table
                    "ncbi_biological_classification",
                    // get fields
                    array("_id", "_label", "_alternative_labels", "rank", "image_wikimedia")
                  );
  // save the supertaxon for connecting with lines
  for($s = 0; $s < count($subclasses); $s++){
    $subclasses[$s]["_supertaxon"] = $result["_id"];
  }

  $taxa = array_merge($taxa, $subclasses);

  $taxa = array_merge($taxa, getAncestors($result, 2));

  // process image and alt labels
  $taxa = processTaxa($taxa);

  echo "0";
  echo json_encode($taxa);
}

// if didn't find one exact match get a list sugestions of similar ones
else{
  $result = getBy($search_term,
                  // from table
                  "ncbi_biological_classification",
                  // get fields
                  array("_id", "_label", "_alternative_labels", "rank", "image_wikimedia"),
                  // from strict fields
                  NULL,
                  // from similar fields
                  array("_label", "_alternative_labels")
                );

  if ($result != NULL) {

    // process image and alt labels

    $result = processTaxa($result);
    echo "1";
    echo json_encode($result);

    // echo "[";
    // for($i = 0; $i < count($result); $i++){
    //   $row = $result[$i];
    //   $rank = getLabel($row["rank"], "ncbi_taxonomic_rank");
    //   if($i>0){
    //     echo ', ';
    //   }
    //   echo '{"_id": "' . $row["_id"] . '", "_label": "' . $row["_label"] . '"}';
    // }
    // echo "]";
  }

  // if still not found
  else{
    echo '2';
  }
}


// Try to get table rows by a term in the defined fields
function getBy($search_term, $table, $get_fields, $strict_from_fields = NULL, $like_from_fields = NULL){
  global $conn;

  $select_from = "SELECT " . implode(",",$get_fields) . " FROM " . $table . " ";

  // get from exact value
  if($strict_from_fields != NULL){
    for($i = 0; $i < count($strict_from_fields); $i++){

      $result = $conn->query($select_from.
        "WHERE " . $strict_from_fields[$i] . "='" . $search_term . "' LIMIT 1"
      );

      if ($result != false && $result->num_rows > 0) {
        return ($result->fetch_assoc());
      }
    }
  }

  // get from similar value
  if($like_from_fields != NULL){
    $rows = array();
    $result = false;
    for($i = 0; $i < count($like_from_fields); $i++){

      $result = $conn->query($select_from.
        "WHERE " . $like_from_fields[$i] . "='" . $search_term . "' LIMIT 1"
      );

      if ($result != false && $result->num_rows > 0) {
        break;
      }

      $result = $conn->query($select_from.
        "WHERE MATCH(" . $like_from_fields[$i] . ") AGAINST('\"" . $search_term . "\"')"
      );

      if ($result != false && $result->num_rows > 0) {
        break;
      }
    }
    if ($result != false && $result->num_rows > 0) {
      while($row = $result->fetch_assoc()) {
        array_push($rows,$row);
      }
      return $rows;
    }
  }

  return NULL;
}

// Get only the label of a row by id
function getLabel($id, $table){
  $result = getById($id, $table, array("_label"));
  if($result != NULL){
    return $result["_label"];
  }
  return NULL;
}

// Get fields of a row by id
function getById($id, $table, $get_fields){
  $result = getBy($id, $table, $get_fields, array("_id"));
  if($result != NULL){
    return $result;
  }
  return NULL;
}

// Get multiple rows by id
function getByIds($idString, $table, $get_fields){
  $results = array();
  for($i = 0; $i < count($idString); $i++){
    $result = getById($idString[$i], $table, $get_fields);
    if($result != NULL){
      array_push($results, $result);
    }
  }
  return $results;
}


function getAncestors($taxon, $levels){
  $taxa = array();
  $taxon["act"] = true;

  for($i = 0; $i < $levels; $i++){
    $superclassId = $taxon["_superclasses"];

    $superclass = getById($superclassId,
                      // from table
                      "ncbi_biological_classification",
                      // get fields
                      array("_id", "_label", "_alternative_labels",
                          "rank", "_superclasses", "_subclasses",
                          "image_wikimedia")
                    );

    if($superclass["_subclasses"]!=NULL)
      $superclass["_subclasses"] = explode("|", $superclass["_subclasses"]);


    if($superclass!=NULL){
      $siblings = getByIds($superclass["_subclasses"],
                        // from table
                        "ncbi_biological_classification",
                        // get fields
                        array("_id", "_label", "_alternative_labels",
                        "rank", "image_wikimedia")
                      );
      // save the supertaxon for connecting with lines
      for($s = 0; $s < count($siblings); $s++){
        if($siblings[$s]["_id"] == $taxon["_id"]){
          $siblings[$s] = $taxon;
        }
        $siblings[$s]["_supertaxon"] = $superclassId;
      }

      $taxa = array_merge($taxa, $siblings);
      $taxon = $superclass;
      $taxon["act"] = true;
    }
    else{
      break;
    }
  }
  // add the top most taxon
  array_push($taxa, $taxon);

  return $taxa;
}

function processTaxa($taxa){
  global $bad;
  for($i = 0; $i < count($taxa); $i++){
    $taxon = $taxa[$i];

    // check and download images
    $image_wikimedia = $taxon["image_wikimedia"];

    if($image_wikimedia != NULL){
      // $image_wikimedia_filename = $taxon["image_wikimedia"] = mb_convert_encoding(str_replace($bad, "", $image_wikimedia), 'HTML-ENTITIES', "UTF-8");
      $image_wikimedia_filename = $taxa[$i]["image_wikimedia"] = mb_convert_encoding(str_replace($bad, "", $image_wikimedia), "UTF-8");

      $height;

      if (file_exists ("files/".$image_wikimedia_filename) && filesize("files/".$image_wikimedia_filename) >= 0){
        $height = getimagesize("files/".$image_wikimedia_filename)[1];
      }
      else{
        $image = @file_get_contents("https://commons.wikimedia.org/w/thumb.php?f=".urlencode($image_wikimedia)."&width=160");
        if($image !== false){
          $imageFromString = imagecreatefromstring($image);
          $height = imagesy($imageFromString);
          file_put_contents("files/".$image_wikimedia_filename, $image);
        }
      }
      $taxa[$i]["image_height"] = $height * (100/160);
    }

    $_alternative_labels = $taxon["_alternative_labels"];
    if($_alternative_labels != NULL){
      $taxa[$i]["_alternative_labels"] = str_replace("|", ", ", $_alternative_labels);
    }
  }
  return $taxa;
}

// for removing filename illegal characters, and ensure proper encoding
$bad = array_merge(
    array_map('chr', range(0,31)),
    array("<", ">", ":", '"', "/", "\\", "|", "?", "*"));

$conn->close();

?>
