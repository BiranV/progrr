"use client";

import React from "react";
import TextCell from "./TextCell";

// Placeholder for other cells to avoid errors during migration
export default function GenericCell(props: any) {
  return <TextCell {...props} />;
}
