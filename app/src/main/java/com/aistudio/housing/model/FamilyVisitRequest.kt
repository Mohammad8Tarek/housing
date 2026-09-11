package com.aistudio.housing.model

data class FamilyVisitRequest(
    val id: Int,
    val requestNumber: String,
    val employeeName: String,
    val status: String,
    val fromDate: String,
    val toDate: String,
    val remarks: String?
)
